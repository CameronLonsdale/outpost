#pragma strict
#pragma downcast
import System.Collections.Generic;

/*
===========================
Classes
===========================
*/

class Message {
	var Content:String = "";
	var Sender:String = "";
	var color:Color;
	
	function Message(i:String, s:String) {
		Message(i, s, Color.grey);
	}
	
	function Message(i:String, s:String, c:Color) {
		this.Content = i;
		this.Sender = s;
		this.color = c;
	}
}

class KillMessage {
	var Killer:String;
	var KillWeapon:String;
	var Killed:String;
	var time:float;
	var color1:Color;
	var color2:Color;
	function KillMessage(k:String, w:String, v:String, c1:Color, c2:Color) {
		this.Killer = k;
		this.KillWeapon = w;
		this.Killed = v;
		this.time = Time.time + 3;
		this.color1 = c1;
		this.color2 = c2;
	}
}

class PointMessage {
	var message:String;
	var points:int;
	var time:float;
	
	function PointMessage(ms:String, pt:int) {
		message = ms;
		points = pt;
		time = Time.time;
	}
}

class NetworkClient extends MonoBehaviour {

/*
===========================
Variables
===========================
*/

private var _serverStatus:ServerStatus = ServerStatus.none;
function get serverStatus():ServerStatus {
    if (Application.loadedLevel > 1) {
        return _serverStatus;
    }
    else {
        return ServerStatus.loading;
    }
}
function set serverStatus(value:ServerStatus) {
    if (value != _serverStatus) {
        _serverStatus = value;
        
        if (!Network.isServer) {
            switch (value) {
                case ServerStatus.preGame:
                    network.RPC("_RequestServerData", RPCMode.Server);
                break;
                case ServerStatus.loading:
                    Application.LoadLevel(1);
                break;
            }
        }
    }
}

@System.NonSerialized
var NetId:int;
@System.NonSerialized
var authenticated:boolean = false;

private var networkManager:NetworkManager;
private var network:NetworkView;
private var server:NetworkServer;

private var movementUpdateQueue:List.<PlayerState>;
private var movementState:PlayerState;
private var vehicleUpdateQueue:List.<VehicleState>;
private var vehicleState:VehicleState;
private var freezePlayer:boolean = false;

//GUI
function get mousePosition():Vector2 {
	return _mousePosition + recoil*(1 - Mathf.Abs(recoilWeight - 1));
}

@System.NonSerialized
var _mousePosition:Vector2;
@System.NonSerialized
var recoil:Vector2;
@System.NonSerialized
var recoilWeight:float;
@System.NonSerialized
var recoilRecoverStart:float;
@System.NonSerialized
var recoilRecoverEnd:float;

private var KillFeed:List.<KillMessage>;
private var Messages:List.<Message>;
private var PointFeed:List.<PointMessage>;

private var messageBoxText:String;

private var teamScreenWeight:float;
private var spawnScreenWeight:float;
private var escapeMenuWeight:float;
private var scorebordWeight:float;
private var optionsWeight:float;
private var mainWeaponWeight:float;
private var secondaryWeaponWeight:float;
private var hudWeight:float;

private var messageBoxTimer:float;
private var hitMarkerTimer:float;
private var damageTimer:float;

private var killTimer:float;
private var killMessage:String;

private var optionsShow:boolean = false;
private var escapeMenu:boolean = false;
private var detect:boolean = false;
private var messageBox:boolean = false;

private var showFPS:boolean = false;
private var showHUD:boolean = true;

private var showAddons:int;
private var optionsType:int;
@System.NonSerialized
var playerKill:String;
@System.NonSerialized
var weaponKill:String;

private var scrollPosition:Vector2;

//Temp Opt Vars
private var IndexList:int;

private var ctime:float;
private var dtime:float;
private var swidth:float;
private var sheight:float;
private var tmpHeight:float;
private var tmpFloat:float;
private var tmpFloat2:float;

private var TempVector:Vector3;

private var pState:PlayerState;
private var player:NPlayer;
private var vState:VehicleState;

private var tmpStringList:String[];
private var playerList:NPlayer[];

//Timers
private var networkTimer:float;
private var pingTimer:float;

private var gameTimer:float;

//Input Manager
private var inputManager:InputState;

//Iterative Variables
private var index:int;
private var nPlayer:NPlayer;

/*
===========================
Inbuild Functions
===========================
*/

function Awake() {
	//Setup References
	networkManager = GetComponent(typeof(NetworkManager)) as NetworkManager;
	network = GetComponent(typeof(NetworkView)) as NetworkView;
	server = GetComponent(typeof(NetworkServer)) as NetworkServer;
	
	//Setup Lists
	KillFeed = new List.<KillMessage>();
	Messages = new List.<Message>();
	
	inputManager = new InputState();
	movementUpdateQueue = new List.<PlayerState>();
	vehicleUpdateQueue = new List.<VehicleState>();
    
    //Load relevant settings
    Loadout.Load();
}

function Start() {
	//Startup authentication (Only when Client is Server)
	if (Network.isServer) {
		authenticated = true;
		networkManager.GetComponent(NetworkServer).AddPlayer(Network.player, AccountSettings.username, AccountSettings.secureCode);
	}
}

//Request Connection On Join
function OnConnectedToServer() {
	network.RPC("_PlayerConnect", RPCMode.Server, AccountSettings.username, AccountSettings.secureCode);
}

//Go to main Menu on diconnection
function OnDisconnectedFromServer() {
	if (!Network.isServer) {
		Application.LoadLevel(0);
        if (!NetworkSettings.showDisconnectMessage) {
            NetworkSettings.disconnectMessage = "You were disconnected from the server";
            NetworkSettings.showDisconnectMessage = true;
        }
	}
}

//Go to main Menu on connection fail
function OnFailedToConnect(error:NetworkConnectionError) {
    Destroy(gameObject);
    Application.LoadLevel(0);
}

//Handle Frame Updates
function Update() {
	ctime = Time.time;
	dtime = Time.deltaTime;
	swidth = Screen.width;
	sheight = Screen.height;
    
    if (NetId in networkManager.NPlayers) {
        player = networkManager.NPlayers[NetId];
    }
    
    if (Network.isServer) {
        serverStatus = networkManager.server.serverStatus;
    }
	
	if (authenticated && networkManager.mapInfo) {
        switch (serverStatus) {
            case ServerStatus.preGame:
                MoveTo(networkManager.mapInfo.SpawnCam);
                Screen.lockCursor = false;
            break;
            
            case ServerStatus.inGame:
                if (player.object) {
                    player.object.NetId = NetId;
                    player.object.Active = true;
                    
                    if (!optionsShow && !escapeMenu && !messageBox) {
                        Screen.lockCursor = true;
                        //Update Input
                        UpdatePlayerInput();
                        inputManager = UpdateInput(inputManager, optionsShow || escapeMenu || messageBox);
                    }
                    else {
                        Screen.lockCursor = false;
                    }
                    
                    //Perform a network Update
                    if (!freezePlayer) {
                        if (networkTimer < Time.time) {
                            NetworkUpdate();
                            networkTimer = Time.time + 1.0/networkManager.UPS;
                        }
                    }
                    
                    if (!player.vehicle) {
                        MoveTo(player.object.cam);
                        
                        //Apply recoil
                        if (recoilWeight < 1) {
                            recoilWeight -= recoilRecoverEnd*Time.deltaTime;
                        }
                        else {
                            recoilWeight -= recoilRecoverStart*Time.deltaTime;
                        }
                        recoilWeight = Mathf.Clamp(recoilWeight, 0, 2);
                    }
                    else {
                        MoveTo(player.vehicle.Cams[player.vehicleSlot]);
                    }
                }
                else {
                    damageTimer = 0;
                    
                    if (movementUpdateQueue.Count != 0) {
                        movementUpdateQueue.Clear();
                    }
                    if (vehicleUpdateQueue.Count != 0) {
                        vehicleUpdateQueue.Clear();
                    }
                    Screen.lockCursor = false;
                    
                    if (player.killCamTimer > Time.time) {
                        
                    }
                    else {
                        MoveTo(networkManager.mapInfo.SpawnCam);
                    }
                }
            break;
            
            case ServerStatus.winScreen:
                MoveTo(networkManager.mapInfo.WinCam);
                Screen.lockCursor = false;
            break;
            
            case ServerStatus.postGame:
                MoveTo(networkManager.mapInfo.PostCam);
                Screen.lockCursor = false;
            break;
            
            case ServerStatus.loading:
                Screen.lockCursor = true;
                transform.position = Vector3.zero;
                transform.rotation = Quaternion.identity;
            break;
        }
        
		UpdateGUIInput();
		//Update weightings for GUI animations
		UpdateGUIWeights();
	}
}

function MoveTo(obj:GameObject) {
    transform.position = obj.transform.position;
    transform.rotation = obj.transform.rotation;
}

function MoveTo(obj:Component) {
    transform.position = obj.transform.position;
    transform.rotation = obj.transform.rotation;
}

function UpdatePlayerInput() {
    if (!player.vehicle) {
        if (Input.GetKeyDown(Controls.grenade)) {
            player.object.ThrowGrenade();
        }
        
        if (Input.GetKeyDown(Controls.reload)) {
            player.object.WeaponStartReload(Time.time);
        }
        else {
            if (Input.GetKey(Controls.fire)) {
                if (player.object.WeaponInputFire(Time.time)) {
                    PlayerShoot();
                }
            }
            
            if (Input.GetKeyDown(Controls.fire)) {
                if (player.object.WeaponInputFireDown(Time.time)) {
                    PlayerShoot();
                }
            }
        }
    }
    else {
        if (Input.GetKey(Controls.fire)) {
            if (player.vehicle.WeaponInputFire(player.vehicleSlot, Time.time)) {
                PlayerShoot();
            }
        }
        
        if (Input.GetKeyDown(Controls.fire)) {
            if (player.vehicle.WeaponInputFireDown(player.vehicleSlot, Time.time)) {
                PlayerShoot();
            }
        }
    }

    //Check for vehicle input
    if (Input.GetKeyDown(Controls.action)) {
        if (Network.isServer) {
            networkManager.server.VehicleToggleInput(NetId);
        }
        else {
            network.RPC("_VehicleToggleInput", RPCMode.Server, NetId);
        }
    }
    
    //check for weapon input feedback
    if (player.object.WeaponUpdate(Time.time)) {
        PlayerShoot();
    }
}

//Handle GUI Updates
function OnGUI() {
    //Set Skin attributes
    GUI.skin = networkManager.CustomSkin;
    tmpFloat = 6+12*(swidth-360)/(1080-360);
    GUI.skin.label.fontSize = tmpFloat;
    GUI.skin.box.fontSize = tmpFloat;
    GUI.skin.button.fontSize = tmpFloat;
    GUI.skin.textField.fontSize = tmpFloat;
    GUI.skin.window.fontSize = tmpFloat;
    
	if (authenticated) {
		switch (serverStatus) {
            case ServerStatus.inGame:
                player = networkManager.NPlayers[NetId];
                
                if (!player.object && networkManager.winTeam == 0) {
                    GUI.color = Color(1, 1, 1, -((player.killCamTimer - ctime) - networkManager.deathTime));
                    
                    if (player.killCamTimer > ctime) {
                        if (playerKill == "n") {
                            GUI.Box(Rect(5, sheight/6*5, swidth, sheight/6), "You died of natural causes");
                        }
                        else if (playerKill == "s") {
                            GUI.Box(Rect(5, sheight/6*5, swidth, sheight/6), "You committed suicide");
                        }
                        else {
                            GUI.Box(Rect(5, sheight/6*5, swidth/2, sheight/6), playerKill + " Killed You");
                            GUI.Box(Rect(5 + swidth/2, sheight/6*5, swidth/2-5, sheight/6), "Using the " + weaponKill);
                        }
                    }
                }
                GUI.color = Color.white;
                        
                //Render All Screens with animations
                
                if (hudWeight > 0.1) {
                    HUDGUI(hudWeight);
                }
            case ServerStatus.postGame:
                
            break;
            case ServerStatus.winScreen:
                if (networkManager.winTeam == player.team) {
                    GUI.Box(Rect(swidth/16*7, sheight/16*7, swidth/16*2, sheight/16), "You Win!");
                }
                else {
                    GUI.Box(Rect(swidth/16*7, sheight/16*7, swidth/16*2, sheight/16), "You Loose!");
                }
            break;
        }
	}
    
    if (serverStatus != ServerStatus.loading) {
        if (spawnScreenWeight > 0.1) {
            SpawnScreen(spawnScreenWeight, mainWeaponWeight, secondaryWeaponWeight);
        }
        
        if (teamScreenWeight > 0.1) {
            TeamSelect(teamScreenWeight);
        }
        
        if (scorebordWeight > 0.1) {
            ScorebordScreen(scorebordWeight);
        }
        
        if (optionsWeight > 0.1) {
            OptionsScreen(optionsWeight);
        }
        
        if (escapeMenuWeight > 0.1) {
            EscapeMenu(escapeMenuWeight);
        }
        
        if (player.team != 0) {
            messageBoxTimer = MessageGUI(messageBoxTimer);
        }
        
        GlobalGUI();
    }
}

function OnReload() {
	network.RPC("_RequestReload", RPCMode.Server, NetId);
}

/*
===========================
RPC's
===========================
*/

@RPC
function _DisconnectMessage(message:String, info:NetworkMessageInfo) {
    if (info.sender == Network.connections[0]) {
        if (message != "") {
            NetworkSettings.disconnectMessage = message;
            NetworkSettings.showDisconnectMessage = true;
        }
    }
}

@RPC
function _SetGameTimer(val:float, info:NetworkMessageInfo) {
    if (Network.isServer || info.sender == Network.connections[0]) {
        gameTimer = val + 1;
	}
}

@RPC
function _UpdateGameStatus(t1k:int, t2k:int, info:NetworkMessageInfo) {
    if (!Network.isServer && info.sender == Network.connections[0]) {
		networkManager.team1Kills = t1k;
        networkManager.team2Kills = t2k;
	}
}

@RPC
function _SetServerStatus(win:int, status:int, info:NetworkMessageInfo) {
	if (Network.isServer || info.sender == Network.connections[0]) {
        networkManager.winTeam = win;
		serverStatus = status;
	}
}

@RPC
function _SetServerData(respawnTime:float, killCamTime:float, gameMode:int, map:int, targetKills:int, info:NetworkMessageInfo) {
    if (!Network.isServer && info.sender == Network.connections[0]) {
		networkManager.respawnTime = respawnTime;
        networkManager.deathTime = killCamTime;
        networkManager.gameMode = gameMode;
        networkManager.map = map;
        networkManager.targetKills = targetKills;
        networkManager.LoadLevel();
	}
}

@RPC
function _HealPlayer(amount:float, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		player.object.Heal(amount);
	}
}

@RPC
function _HealIndication(amount:float, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		HealIndication(amount);
	}
}

@RPC
function _DamagePlayer(amount:float, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		DamagePlayer(amount);
	}
}

@RPC
function _KillNotification(id:int, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		KillNotification(id);
	}
}

@RPC
function _AssistNotification(id:int, amount:int, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		AssistNotification(id, amount);
	}
}

@RPC
function _DamageVehicle(index:int, amount:float, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		networkManager.VehicleList[index].Damage(amount);
	}
}

@RPC
function _VehicleKillNotification(index:int, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		VehicleKillNotification(index);
	}
}

@RPC
function _VehicleAssistNotification(index:int, amount:int, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		VehicleAssistNotification(index, amount);
	}
}

@RPC
function _KillPlayer(id:int, kid:int, weapon:String, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		networkManager.NPlayers[id].Kill();
		networkManager.HandleKill(id, kid, weapon);
	}
}

@RPC
function _KillFeedMessage(name1:String, method:String, name2:String, 
		r1:float, g1:float, b1:float,
		r2:float, g2:float, b2:float,
	info:NetworkMessageInfo) {
	if (Network.isServer || info.sender == Network.connections[0]) {
		KillFeed.Insert(0, KillMessage(name1, method, name2, Color(r1, g1, b1), Color(r2, g2, b2)));
	}
}

@RPC
function _HitMarker(amount:float) {
	hitMarkerTimer = ctime + Mathf.Clamp(amount/30, 0.3, 2);
}

@RPC
function _UpdatePlayer(id:int, position:Vector3, rotation:float, grounded:boolean, lookAngle:float, selectionWeight:float, crouchWeight:float, standWeight:float, animationState:int, aimWeight:float, selected:int, info:NetworkMessageInfo) {
	if (!Network.isServer && info.sender == Network.connections[0]) {
		//Regenerate Player State
		if (id == NetId) {
			if (movementUpdateQueue.Count > 0) {
				
				pState = movementUpdateQueue[0];
				movementUpdateQueue.RemoveAt(0);
				
				if (pState.position != position) {
					if (movementUpdateQueue.Count > 0) {
						freezePlayer = true;
					}
					else {
						player.object.nextState.position = position;
						player.object.previousState.position = position;
						freezePlayer = false;
					}
				}
				else {
					freezePlayer = false;
				}
			}
			vehicleUpdateQueue.Clear();
		}
		else {
			pState = new PlayerState();
			
			pState.position = position;
			pState.rotation = rotation;
			
			pState.grounded = grounded;
			
			pState.lookAngle = lookAngle;
			pState.selectionWeight = selectionWeight;
			pState.selected = selected;
			
			pState.crouchWeight = crouchWeight;
			pState.standWeight = standWeight;
			pState.animationState = animationState;
			
			pState.aimWeight = aimWeight;
			
			networkManager.NPlayers[id].object.previousState = networkManager.NPlayers[id].object.nextState;
			networkManager.NPlayers[id].object.previousState.timestamp = Time.time;
			networkManager.NPlayers[id].object.nextState = pState;
			networkManager.NPlayers[id].object.nextState.timestamp = Time.time + 1.0/networkManager.UPS;
		}
	}
}

@RPC
function _UpdateCapturePoint(index:int, cp:float, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0] && Application.loadedLevel > 1) {
		if (networkManager.gameMode == GameModes.KOTH) {
			networkManager.mapInfo.CaptureTheFlagPoint.CP = cp;
		}
		else if (networkManager.gameMode == GameModes.CP) {
			networkManager.mapInfo.CapturePointPoints[index].CP = cp;
		}
	}
}

@RPC
function _RemovePlayer(id:int, info:NetworkMessageInfo) {
	if (Network.isServer || info.sender == Network.connections[0]) {
		networkManager.KillPlayer(id);
		networkManager.NPlayers.Remove(id);
	}
}

@RPC
function _AddPlayer(np:NetworkPlayer, id:int, username:String, info:NetworkMessageInfo) {
	if (Network.isServer || info.sender == Network.connections[0]) {
		networkManager.NPlayers[id] = new NPlayer(np, id, username, "");
		if (np == Network.player) {
			NetId = id;
			player = networkManager.NPlayers[NetId];
			authenticated = true;
		}
	}
}

@RPC
function _PingRequest(info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		network.RPC("_PingReply", RPCMode.Server, NetId);
	}
}

@RPC
function _UpdateLatancy(latancy:float, info:NetworkMessageInfo) {
	if (Network.isServer || info.sender == Network.connections[0]) {
		player.latancy = latancy;
	}
}

@RPC
function _SendPMessage(id:int, input:String) {
	SendPMessage(id, input);
}

@RPC
function _PlayerShoot(id:int, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		if (networkManager.NPlayers[id].object) {
			if (networkManager.NPlayers[id].vehicle) {
				networkManager.NPlayers[id].vehicle.WeaponFire(networkManager.NPlayers[id].vehicleSlot);
			}
			else {
				networkManager.NPlayers[id].object.WeaponFire();
			}
		}
	}
}

@RPC
function _PlayerReload(id:int) {
	networkManager.NPlayers[id].object.WeaponStartReload(Time.time);
}

@RPC
function _VehiclePlayerEnter(id:int, index:int) {
	networkManager.NPlayers[id].vehicle = networkManager.VehicleList[index];
	networkManager.VehicleList[index].PlayerEnter(id);
}

@RPC
function _VehiclePlayerExit(id:int) {
	networkManager.NPlayers[id].vehicle.PlayerLeave(id);
	networkManager.NPlayers[id].vehicle = null;
}

@RPC
function _VehicleUpdate(index:int, slot:int, position:Vector3, rotation:float, lookAngle:float) {
	if (networkManager.VehicleList[index].Slots[slot] == NetId) {
		if (vehicleUpdateQueue.Count > 0) {
			vState = vehicleUpdateQueue[0];
			vehicleUpdateQueue.RemoveAt(0);
			
			if (vState.position != position) {
				if (vehicleUpdateQueue.Count > 0) {
					freezePlayer = true;
				}
				else {
					player.vehicle.nextStates[player.vehicleSlot].position = position;
					player.vehicle.previousStates[player.vehicleSlot].position = position;
					freezePlayer = false;
				}
			}
			else {
				freezePlayer = false;
			}
		}
		movementUpdateQueue.Clear();
	}
	else {
		vState = new VehicleState();
		
		vState.position = position;
		vState.rotation = rotation;
		
		vState.lookAngle = lookAngle;
		
		networkManager.VehicleList[index].previousStates[slot] = networkManager.VehicleList[index].nextStates[slot];
		networkManager.VehicleList[index].previousStates[slot].timestamp = Time.time;
		networkManager.VehicleList[index].nextStates[slot] = vState;
		networkManager.VehicleList[index].nextStates[slot].timestamp = Time.time + 1.0/networkManager.UPS;
	}
}

/*
===========================
Update Functions
===========================
*/

function KillNotification(id:int) {
	//PointFeed.Add(PointMessage("Kill", 100));
	killTimer = Time.time + 2;
	killMessage = "You Killed " + networkManager.NPlayers[id].username;
}

function AssistNotification(id:int, amount:float) {
	//PointFeed.Add(PointMessage("Assist", amount));
}

function VehicleKillNotification(index:int) {
	
}

function VehicleAssistNotification(index:int, amount:float) {
	
}

function HealIndication(amount:float) {
	//PointFeed.Add(PointMessage("Heal", amount));
}

function SendPMessage(id:int, input:String) {
	if (id == -1) {
		Messages.Add(Message(input, "Server", Color.gray));
	}
	else if (id != NetId) {
		if (networkManager.NPlayers[id].team == 1) {
			Messages.Add(Message(input, networkManager.NPlayers[id].username, networkManager.BlueColor));
		}
		else {
			Messages.Add(Message(input, networkManager.NPlayers[id].username, networkManager.GreenColor));
		}
	}
	else {
		if (player.team == 1) {
			Messages.Add(Message(input, AccountSettings.username, networkManager.BlueColor));
		}
		else {
			Messages.Add(Message(input, AccountSettings.username, networkManager.GreenColor));
		}
	}
	if (Messages.Count > 18) {
		Messages.RemoveAt(0);
	}
}

function PlayerShoot() {
	if (!Network.isServer) {
		network.RPC("_PlayerFireRequest", RPCMode.Server, NetId);
	}
	else {
		networkManager.server.OnPlayerFire(NetId);
	}
}

function DamagePlayer(amount:float) {
	damageTimer = ctime + amount/30;
	player.object.Damage(amount);
}

function UpdateInput(input:InputState, disabled:boolean) {
	if (!disabled) {
		_mousePosition += Vector2(Input.GetAxis("Mouse X")*Controls.Sensitivity*(1 - player.object.currentState.aimWeight), Input.GetAxis("Mouse Y")*Controls.Sensitivity);
		
		_mousePosition.x = Mathf.Clamp(_mousePosition.x, 0, Screen.width);
		_mousePosition.y = Mathf.Clamp(_mousePosition.y, 0, Screen.height);
		
		tmpFloat = Mathf.Lerp(mousePosition.x, Screen.width*player.object.currentState.rotation, player.object.currentState.aimWeight);
		if (!player.vehicle) {
			player.object.currentState.lookAngle = Mathf.Rad2Deg*Mathf.Atan2(Mathf.Abs(tmpFloat - Screen.width/2), mousePosition.y - Screen.height/2);
		}
		else {
			player.vehicle.currentStates[player.vehicleSlot].lookAngle = Mathf.Rad2Deg*Mathf.Atan2(Mathf.Abs(tmpFloat - Screen.width/2), mousePosition.y - Screen.height/2);
		}
		
		input.horizontal += Input.GetAxis("Horizontal");
		input.vertical += Input.GetAxis("Vertical");
	}
	
	if (Input.GetKey(Controls.crouch) && !disabled) {
		input.crouch += 1;
	}
	else {
		input.crouch -= 1;
	}
	
	if (mousePosition.x < Screen.width/2) {
		input.rotation -= 1;
	}
	else {
		input.rotation += 1;
	}
	
	if (!player.vehicle) {
		tmpFloat = player.object.currentWeapon.Sight[player.object.currentWeapon.Addons[0]].VewDistance;
		if (Input.GetKey(Controls.aim) && player.object.currentState.animationState != 1 && 
		!disabled && !player.object.weaponReloading && 
		(player.object.currentWeapon.BullInCham || !player.object.currentWeapon.ChamberBullet)) {
			player.object.currentState.aimWeight += 8*Time.deltaTime/tmpFloat;
		}
		else {
			player.object.currentState.aimWeight -= 8*Time.deltaTime/tmpFloat;
		}
		player.object.currentState.aimWeight = Mathf.Clamp01(player.object.currentState.aimWeight);
	}
	else {
		player.object.currentState.aimWeight = 0;
	}
	
	if (networkManager.gameMode != 4) {
		if (Input.GetKeyDown(Controls.quickswap)) {
			if (input.switchTo == 0) {
				input.switchTo = 1;
			}
			else {
				input.switchTo = 0;
			}
		}
		else if (Input.GetKeyDown(Controls.stp)) {
			input.switchTo = 0;
		}
		else if (Input.GetKeyDown(Controls.sts)) {
			input.switchTo = 1;
		}
	}
	else {
		input.switchTo = 0;
	}
	
	if (!disabled) {
		if (!input.sprint) {
			input.sprint = ((Input.GetKey(Controls.sprint) && Controls.normalSprint == 0) || (!Input.GetKey(Controls.sprint) && Controls.normalSprint == 1));
		}
		
		if (!input.jump) {
			input.jump = Input.GetKeyDown(Controls.jump);
		}
		
		if (Input.GetKey(Controls.action)) {
			input.ladder = true;
		}
		
		//Check for vehicle entering
		
	}
	
	input.times += 1;
	
	return input;
}

//Handles Network Updates
function NetworkUpdate() {
	//Server
	inputManager.Average();
	network.RPC("_UpdateInput", RPCMode.Server, NetId, player.object.currentState.lookAngle, inputManager.horizontal, inputManager.vertical, inputManager.crouch, inputManager.rotation, inputManager.sprint, inputManager.jump, inputManager.ladder, player.object.currentState.aimWeight, inputManager.switchTo);
	
	if (Network.isServer) {
		networkManager.server.UpdateInput(inputManager, NetId);
	}
	else {
		if (!player.vehicle) {
			//Client prediction
			pState = player.object.Move(inputManager, 1.0/networkManager.UPS);
			movementUpdateQueue.Add(pState);
		}
		else {
			vState = player.vehicle.Move(player.vehicleSlot, inputManager, 1.0/networkManager.UPS);
			vehicleUpdateQueue.Add(vState);
		}
	}
	
	inputManager.Reset();
}

function UpdateGUIInput() {
	//Update GUI
	IndexList = 0;
	for (kfm in KillFeed){
		if (kfm.time < Time.time) {
			KillFeed.RemoveAt(IndexList);
			break;
		}
		IndexList += 1;
	}
	
	
	if (Input.GetKeyDown(KeyCode.Escape) && !optionsShow){
		escapeMenu = !escapeMenu;
		messageBox = false;
	}
	if (Input.GetKeyDown(KeyCode.Escape) && optionsShow){
		optionsShow = false;
		escapeMenu = true;
		messageBox = false;
	}
	
	if (player.team != 0) {
		if (messageBox) {
            if (Input.GetKeyDown(KeyCode.Return)) {
                messageBoxText = messageBoxText.Replace("\n", "").Replace("\r", "");
                if (messageBoxText == ""){
                    messageBox = false;
                }
                else {
                    if (messageBoxText[0] != "/") {
                        networkView.RPC("_SendPMessage", RPCMode.All, NetId, messageBoxText);
                    }
                    else {
                        messageBoxText.ToLower().Replace("/", "");
                        SendPMessage(-1, "Message-Function are currently unsupported");
                    }
                    
                    messageBoxText = "";
                    messageBox = false;
                }
            }
            else if (Input.GetKeyDown(KeyCode.Escape)) {
                messageBoxText = "";
                messageBox = false;
            }
		}
	}
	
	if ((Input.GetKey(KeyCode.Tab) && !optionsShow && !escapeMenu) || serverStatus == ServerStatus.postGame) {
		scorebordWeight += dtime*5;
	}
	else {
		scorebordWeight -= dtime*5;
	}
	
	scorebordWeight = Mathf.Clamp(scorebordWeight, 0, 1);
}

//Handles Weightings for GUI animatinos
function UpdateGUIWeights() {
	if (player.team == 0) {
		teamScreenWeight += dtime*2;
		hudWeight -= dtime*2; 
		spawnScreenWeight -= dtime*2;
	}
	else if (player.killCamTimer < ctime && (serverStatus == ServerStatus.preGame || serverStatus == ServerStatus.inGame)) {
		teamScreenWeight -= dtime*2;
		
		if (player.object) {
			spawnScreenWeight -= dtime*2;
			hudWeight += dtime*2;
		}
		else {
			spawnScreenWeight += dtime*2;
			hudWeight -= dtime*2;
		}
	}
	else {
		teamScreenWeight -= dtime*2;
		hudWeight -= dtime*2; 
		spawnScreenWeight -= dtime*2;
	}
	
	teamScreenWeight = Mathf.Clamp01(teamScreenWeight);
	spawnScreenWeight = Mathf.Clamp01(spawnScreenWeight);
	hudWeight = Mathf.Clamp01(hudWeight);
	
	if (optionsShow) {
		escapeMenuWeight -= dtime*2;
		optionsWeight += dtime*2;
	}
	else if (escapeMenu) {
		escapeMenuWeight += dtime*2;
		optionsWeight -= dtime*2;
	}
	else {
		escapeMenuWeight -= dtime*2;
		optionsWeight -= dtime*2;
	}
	
	optionsWeight = Mathf.Clamp01(optionsWeight);
	escapeMenuWeight = Mathf.Clamp01(escapeMenuWeight);
	
	if (showAddons == 1) {
		mainWeaponWeight += dtime*5;
		secondaryWeaponWeight -= dtime*5;
	}
	else if (showAddons == 2) {
		mainWeaponWeight -= dtime*5;
		secondaryWeaponWeight += dtime*5;
	}
	else {
		mainWeaponWeight -= dtime*5;
		secondaryWeaponWeight -= dtime*5;
	}
	
	mainWeaponWeight = Mathf.Clamp01(mainWeaponWeight);
	secondaryWeaponWeight = Mathf.Clamp01(secondaryWeaponWeight);
}

/*
===========================
GUI Functions
===========================
*/

function TeamSelect(weight:float) {
	if (MouseInRect(Rect(0, 0, swidth/4, sheight))) {
		GUI.color = Color(0, 0, 1, 0.1*weight);
	}
	else if (MouseInRect(Rect(swidth/4*3, 0, swidth/4, sheight))) {
		GUI.color = Color(0, 1, 0, 0.1*weight);
	}
	else {
		GUI.color = Color(0, 0, 0, 0.1*weight);
	}
	GUI.DrawTexture(Rect(0, 0, swidth, sheight), networkManager.White);

	GUI.color = Color(1, 1, 1, weight);
	if (GUI.Button(Rect((weight - 1)*swidth/3, 0, swidth/4, sheight), networkManager.FlagBlue) && player.team == 0) {
		networkView.RPC("_JoinRequest", RPCMode.All, NetId, 1);
	}
	if (GUI.Button(Rect(swidth/4*3 + (1 - weight)*swidth/3, 0, swidth/4, sheight), networkManager.FlagGreen) && player.team == 0) {
		networkView.RPC("_JoinRequest", RPCMode.All, NetId, 2);
	}
}

function SpawnScreen(weight:float, mainWeight:float, secondaryWeight:float) {
	//Background tint
	if (player.team == 1) {
		GUI.color = Color(0, 0, 1, 0.1*weight);
	}
	else {
		GUI.color = Color(0, 1, 0, 0.1*weight);
	}
	GUI.DrawTexture(Rect(0, 0, swidth, sheight), networkManager.White);
	
	//Spawn Button
	GUI.color = Color(1, 1, 1, weight);
	if (player.respawnTimer < ctime && serverStatus == ServerStatus.inGame) {
		if (GUI.Button(Rect(0, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), "") && !player.object){
			if (Network.isServer) {
				networkManager.server.SpawnRequest(NetId, 
					Loadout.selectedMain, 
					Loadout.selectedSecondary, 
					Loadout.gunsMain[Loadout.selectedMain].Addons[0], 
					Loadout.gunsMain[Loadout.selectedMain].Addons[1], 
					Loadout.gunsMain[Loadout.selectedMain].Addons[2], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[0], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[1], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[2], 
					Loadout.selectedGrenade
				);
			}
			else {
				network.RPC("_SpawnRequest", RPCMode.Server, NetId, 
					Loadout.selectedMain, 
					Loadout.selectedSecondary, 
					Loadout.gunsMain[Loadout.selectedMain].Addons[0], 
					Loadout.gunsMain[Loadout.selectedMain].Addons[1], 
					Loadout.gunsMain[Loadout.selectedMain].Addons[2], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[0], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[1], 
					Loadout.gunsSecondary[Loadout.selectedSecondary].Addons[2], 
					Loadout.selectedGrenade
				);
			}
            Loadout.Save();
		}
		GUI.Label(Rect(0, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), "Spawn");
	}
	else {
        if (serverStatus == ServerStatus.inGame) {
            GUI.Button(Rect(0, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), parseInt(player.respawnTimer + 1 - ctime) + "");
        }
        else {
            GUI.Button(Rect(0, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), parseInt(gameTimer) + "");
        }
	}
	
	//Main Gun Select
	Loadout.selectedMain = GUIGun(Rect(swidth/4, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), Loadout.gunsMain, mainWeaponWeight, parseInt(Loadout.selectedMainClass), Loadout.selectedMain, 1);
	
	//Main Gun Category Select
	GUI.color.a = 1 - (escapeMenuWeight + optionsWeight);
	if ((1 - mainWeaponWeight)*(1 - (escapeMenuWeight + optionsWeight)) > 0.1) {
		if (GUI.Button(Rect(swidth/8*2, sheight/16*13 + sheight/3*(1 - weight) + sheight/16*(mainWeaponWeight), swidth/8*2, sheight/16*(1 - mainWeaponWeight)), "" + Loadout.selectedMainClass) && (!optionsShow) && (!escapeMenu)) {
			if (parseInt(Loadout.selectedMainClass) + 1 == 9) {
				Loadout.selectedMainClass = System.Enum.ToObject(typeof(GunClass), 0);
			}
			else {
				Loadout.selectedMainClass = System.Enum.ToObject(typeof(GunClass), parseInt(Loadout.selectedMainClass) + 1);
			}
			Loadout.selectedMain = GUIGunLoop(1, Loadout.gunsMain, parseInt(Loadout.selectedMainClass), 0);
		}
	}
	GUI.color = Color.white;
	
	//Secondary Gun Select
	Loadout.selectedSecondary = GUIGun(Rect(swidth/4*2, sheight/16*14 + sheight/3*(1 - weight), swidth/4, sheight/16*2), Loadout.gunsSecondary, secondaryWeaponWeight, parseInt(Loadout.selectedSecondaryClass), Loadout.selectedSecondary, 2);
	
	//Secondary Gun Category Select
	GUI.color.a = 1 - (escapeMenuWeight + optionsWeight);
	if ((1 - secondaryWeaponWeight)*(1 - (escapeMenuWeight + optionsWeight)) > 0.1) {
		if (GUI.Button(Rect(swidth/8*4, sheight/16*13 + sheight/3*(1 - weight) + sheight/16*(secondaryWeaponWeight), swidth/8*2, sheight/16*(1 - secondaryWeaponWeight)), "" + Loadout.selectedSecondaryClass) && (!optionsShow) && (!escapeMenu)) {
			if (parseInt(Loadout.selectedSecondaryClass) == 13) {
				Loadout.selectedSecondaryClass = System.Enum.ToObject(typeof(GunClass), 9);
			}
			else {
				Loadout.selectedSecondaryClass = System.Enum.ToObject(typeof(GunClass), parseInt(Loadout.selectedSecondaryClass) + 1);
			}
			Loadout.selectedSecondary = GUIGunLoop(1, Loadout.gunsSecondary, parseInt(Loadout.selectedSecondaryClass), 0);
		}
	}
	GUI.color = Color.white;
	
	//Grenade Select
	if (GUI.Button(Rect(swidth/4*3, sheight/16*14 + sheight/3*(1 - weight), swidth/4/6, sheight/16*2), networkManager.ArrowTexture2)) {
		Loadout.selectedGrenade += 1;
		if (Loadout.selectedGrenade == 4) {
			Loadout.selectedGrenade = 0;
		}
	}
	if (GUI.Button(Rect(swidth/4*3 + swidth/4/6*5, sheight/16*14 + sheight/3*(1 - weight), swidth/4/6, sheight/16*2), networkManager.ArrowTexture)) {
		Loadout.selectedGrenade -= 1;
		if (Loadout.selectedGrenade == -1) {
			Loadout.selectedGrenade = 3;
		}
	}
	GUI.Box(Rect(swidth/4*3 + swidth/4/6,  sheight/16*14 + sheight/3*(1 - weight), swidth/4/6*4, sheight/16*2), networkManager.PlayerObjects[Loadout.selectedGrenade].GetComponent(Grenade).Icon);
	GUI.Label(Rect(swidth/4*3 + swidth/4/6,  sheight/16*14 + sheight/3*(1 - weight), swidth/4/6*4, sheight/16), networkManager.PlayerObjects[Loadout.selectedGrenade].GetComponent(Grenade).Name);
}

//SpawnScreen Helpers
function GUIGun(rect:Rect, guns:Gun[], weight:float, selectedClass:int, current:int, type:int) {
	
	//Gun Select
	if (GUI.Button(Rect(rect.x + rect.width/6*5, rect.y, rect.width/6, rect.height), networkManager.ArrowTexture) && !player.object) {
		current = GUIGunLoop(1, guns, selectedClass, current);
	}
	if (GUI.Button(Rect(rect.x, rect.y, rect.width/6, rect.height), networkManager.ArrowTexture2) && !player.object) {
		current = GUIGunLoop(-1, guns, selectedClass, current);
	}
	
	//Gun Display
	if (GUI.Button(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height), "") && !player.object && !optionsShow){
		if (showAddons == type) {
			showAddons = 0;
		}
		else {
			showAddons = type;
		}
	}
	
	GUI.DrawTexture(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height), guns[current].texture, ScaleMode.ScaleToFit);
	GUI.Label(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height/2), guns[current].Name);
	
	if ((MouseInRect(rect)) && (showAddons != type) && (!escapeMenu) && (!optionsShow)) {
		GUI.Box(Rect(rect.x, rect.y - rect.height/2*3, rect.width, rect.height), guns[current].Description);
	}
	
	//Addon Select
	guns[current] = GUIGunAddons(rect, guns[current], weight, type);
	
	return current;
}

function GUIGunLoop(incrament:int, guns:Gun[], selectedClass:int, current:int) {
	IndexList = 0;
	while (true && IndexList < 1000) {
		current += incrament;
		
		if (current == guns.length) {
			current = 0;
		}
		else if (current == -1) {
			current = guns.length -1;
		}
		
		if (parseInt(guns[current].Class) == selectedClass || selectedClass == 0) {
			break;
		}
		IndexList += 1;
	}
	return current;
}

function GUIGunAddons(rect:Rect, gun:Gun, weight:float, type:int) {

	gun.Addons[0] = Mathf.Clamp(gun.Addons[0], 0, gun.Sight.length-1);
	gun.Addons[1] = Mathf.Clamp(gun.Addons[1], 0, gun.Front.length-1);
	gun.Addons[2] = Mathf.Clamp(gun.Addons[2], 0, gun.Under.length-1);
	if (weight > 0.1) {
		gun.Addons[0] = GUIAddon(Rect(rect.x, rect.y - rect.height*3*weight, rect.width, rect.height*weight), gun.Sight[gun.Addons[0]], gun.Addons[0], gun.Sight.length, type);
		gun.Addons[1] = GUIAddon(Rect(rect.x, rect.y - rect.height*2*weight, rect.width, rect.height*weight), gun.Front[gun.Addons[1]], gun.Addons[1], gun.Front.length, type);
		gun.Addons[2] = GUIAddon(Rect(rect.x, rect.y - rect.height*weight, rect.width, rect.height*weight), gun.Under[gun.Addons[2]], gun.Addons[2], gun.Under.length, type);
	}
	
	return gun;
}

function GUIAddon(rect:Rect, addon:GunAddon, current:int, max:int, type:int) {
	if (GUI.Button(Rect(rect.x + rect.width/6*5, rect.y, rect.width/6, rect.height), networkManager.ArrowTexture) && !player.object) {
		current += 1;
	}
	if (GUI.Button(Rect(rect.x, rect.y, rect.width/6, rect.height), networkManager.ArrowTexture2) && !player.object) {
		current -= 1;
	}
	
	current = Mathf.Clamp(current, 0, max);
	
	GUI.Box(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height), "");
	GUI.DrawTexture(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height), addon.texture, ScaleMode.ScaleToFit);
	GUI.Label(Rect(rect.x + rect.width/6, rect.y, rect.width/6*4, rect.height/2), addon.Name);
	
	if ((MouseInRect(rect) && (addon.Name != "None"))){
		if (type == 1) {
			GUI.Box(Rect(rect.x - rect.width, rect.y, rect.width, rect.height), addon.Description);
		}
		else {
			GUI.Box(Rect(rect.x + rect.width, rect.y, rect.width, rect.height), addon.Description);
		}
	}
	return current;
}

function OptionsScreen(weight:float) {
	GUI.color = Color(1, 1, 1, weight);
	GUI.Box(Rect(swidth/8*9/4, sheight/16, swidth/8*14/4,  sheight/16*13*weight), "");
	
	GUILayout.BeginArea(Rect(swidth/8*9/4 + 10, sheight/16 + 10, swidth/8*14/4 - 20, (sheight/16*13 - 20)*weight));
	
		optionsType = GUILayout.SelectionGrid(optionsType, ["Video",  "Controls"], 2, GUILayout.Height(Screen.height/18));
		
		//First Options Page
		if(optionsType == 0){
			GUILayout.BeginHorizontal();
			GUILayout.Label("Quality Level");
			GUILayout.FlexibleSpace();
			if (GUILayout.Button("<")){
				VideoSettings.qualityLevel = Mathf.Clamp(VideoSettings.qualityLevel - 1, 0, VideoSettings.qualityLevels.length - 1);
			}
			GUILayout.Label(VideoSettings.qualityLevels[VideoSettings.qualityLevel], GUILayout.Width(swidth/8*17/16));
			if (GUILayout.Button(">")) {
				VideoSettings.qualityLevel = Mathf.Clamp(VideoSettings.qualityLevel + 1, 0, VideoSettings.qualityLevels.length - 1);
			}
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Screen Size");
			GUILayout.FlexibleSpace();
			if (GUILayout.Button("<")) {
				VideoSettings.resolution  = Mathf.Clamp(VideoSettings.resolution - 1, 0, VideoSettings.resolutions.length - 1);
			}
			GUILayout.Label(VideoSettings.resolutions[VideoSettings.resolution].x + "x" + VideoSettings.resolutions[VideoSettings.resolution].y, GUILayout.Width(swidth/8*17/16));
			if (GUILayout.Button(">")) {
				VideoSettings.resolution  = Mathf.Clamp(VideoSettings.resolution + 1, 0, VideoSettings.resolutions.length - 1);
			}
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Fullscreen");
			GUILayout.FlexibleSpace();
			if (VideoSettings.fullScreen) {
				if (GUILayout.SelectionGrid(1, ["Off",  "On"], 2, GUILayout.Width(swidth/8*22/16), GUILayout.Height(sheight/26)) == 0) {
					VideoSettings.fullScreen = false;
				}
			}
			else {
				if (GUILayout.SelectionGrid(0, ["Off", "On"], 2, GUILayout.Width(swidth/8*22/16), GUILayout.Height(sheight/26)) == 1) {
					VideoSettings.fullScreen = true;
				}
			}
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Texture Quality");
			GUILayout.FlexibleSpace();
			if (GUILayout.Button("<")) {
				VideoSettings.textureMipMapLevel = Mathf.Clamp(VideoSettings.textureMipMapLevel + 1, 0, VideoSettings.textureMipMaps.length - 1);
			}
			GUILayout.Label(VideoSettings.textureMipMaps[VideoSettings.textureMipMapLevel], GUILayout.Width(swidth/8*17/16));
			if (GUILayout.Button(">")) {
				VideoSettings.textureMipMapLevel = Mathf.Clamp(VideoSettings.textureMipMapLevel - 1, 0, VideoSettings.textureMipMaps.length - 1);
			}
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Shadow Distance");
			GUILayout.FlexibleSpace();
			GUILayout.Label(parseInt(VideoSettings.shadowDistance) + "");
			VideoSettings.shadowDistance = parseInt(GUILayout.HorizontalSlider(VideoSettings.shadowDistance, 0, 80, GUILayout.Width(swidth/8*21/16)));
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Volume");
			GUILayout.FlexibleSpace();
			GUILayout.Label(parseInt(SoundSettings.volume*100) + "");
			SoundSettings.volume = GUILayout.HorizontalSlider(SoundSettings.volume, 0.0, 1.0, GUILayout.Width(swidth/8*21/16));
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Sensitivity");
			GUILayout.FlexibleSpace();
			GUILayout.Label(parseInt(Controls.Sensitivity)/5 + "");
			Controls.Sensitivity = GUILayout.HorizontalSlider(Controls.Sensitivity, 0.0, 500, GUILayout.Width(swidth/8*21/16));
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Anti Aliasing");
			GUILayout.FlexibleSpace();
			if (GUILayout.Button("<")) {
				VideoSettings.antiAliasing = Mathf.Clamp(VideoSettings.antiAliasing - 1, 0, VideoSettings.antiAliasings.length - 1);
			}
			if (VideoSettings.antiAliasing != 0){
				GUILayout.Label(VideoSettings.antiAliasings[VideoSettings.antiAliasing] + "x", GUILayout.Width(swidth/8*17/16));
			}
			else{
				GUILayout.Label("Disabled", GUILayout.Width(swidth/8*17/16));
			}
			if (GUILayout.Button(">")) {
				VideoSettings.antiAliasing = Mathf.Clamp(VideoSettings.antiAliasing + 1, 0, VideoSettings.antiAliasings.length - 1);
			}
			GUILayout.EndHorizontal();
		}
		else {
			//Second Options Page
			scrollPosition = GUILayout.BeginScrollView(scrollPosition);
			
			Controls.jump = KeyField(Controls.jump, "Jump");
			
			GUILayout.Space(10);
			
			Controls.crouch = KeyField(Controls.crouch, "Crouch");
			
			GUILayout.Space(10);
			
			Controls.sprint = KeyField(Controls.sprint, "Sprint");
			
			GUILayout.Space(10);
			
			Controls.action = KeyField(Controls.action, "Action");
			
			GUILayout.Space(10);
			
			Controls.stp = KeyField(Controls.stp, "Primary Weapon");
			
			GUILayout.Space(10);
			
			Controls.sts = KeyField(Controls.sts, "Secondary Weapon");
			
			GUILayout.Space(10);
			
			Controls.quickswap = KeyField(Controls.quickswap, "Quick Swap");
			
			GUILayout.Space(10);
			
			Controls.reload = KeyField(Controls.reload, "Reload");
			
			GUILayout.Space(10);
			
			Controls.grenade = KeyField(Controls.grenade, "Grenade");
			
			GUILayout.Space(10);
			
			Controls.chat = KeyField(Controls.chat, "Global Chat");
			
			GUILayout.Space(10);
			
			Controls.fire = KeyField(Controls.fire, "Fire");
			
			GUILayout.Space(10);
			
			Controls.aim = KeyField(Controls.aim, "Aim");
			
			GUILayout.Space(10);
			
			GUILayout.BeginHorizontal();
			GUILayout.Label("Sprint Type");
			GUILayout.FlexibleSpace();
			Controls.normalSprint = GUILayout.SelectionGrid(Controls.normalSprint, ["Run", "Walk"], 2, GUILayout.Height(sheight/20), GUILayout.Width(swidth/8*21/16));
			GUILayout.EndHorizontal();
			
			GUILayout.Space(10);
			
			GUILayout.EndScrollView();
		}
		
		GUILayout.FlexibleSpace();
		
		GUILayout.BeginHorizontal();
		if (GUILayout.Button("Save")) {
			optionsShow = false;
			Controls.Save();
            SoundSettings.Save();
			VideoSettings.Save();
			VideoSettings.Apply();
		}
		if (GUILayout.Button("Exit Without Saving")) {
			optionsShow = false;
			Controls.Load();
            SoundSettings.Save();
			VideoSettings.Load();
		}
		if (GUILayout.Button("Restore to Default")){
			Controls.Reset();
		}
		GUILayout.EndHorizontal();
	GUILayout.EndArea();
}

function EscapeMenu(weight:float) {
	showAddons = 0;
	GUI.color = Color(1, 1, 1, weight);
	//Background
	GUI.Box(Rect(swidth/8*9/4, sheight/16, swidth/8*14/4, sheight/16*13*weight), "");
	GUILayout.BeginArea(Rect(swidth/8*9/4 + 10, sheight/16 + 10, swidth/8*14/4 - 20, sheight/16*13*weight - 20));
	
	//Disconnect Button
	if (GUILayout.Button("Disconnect", GUILayout.ExpandHeight(true))) {
		networkManager.Disconnect();
	}
	
	GUILayout.Space(10);
	
	//Change Team Button
	if (GUILayout.Button("Change Team", GUILayout.ExpandHeight(true))) {
		if (Network.isServer) {
			server._LeaveRequest(NetId, new NetworkMessageInfo());
		}
		network.RPC("_LeaveRequest", RPCMode.Server, NetId);
		escapeMenu = false;
	}
	
	GUILayout.Space(10);
	
	//Suicide Button
	if (player.object) {
		if (GUILayout.Button("Suicide", GUILayout.ExpandHeight(true))) {
			network.RPC("_SuicideRequest", RPCMode.Server, NetId);
			escapeMenu = false;
			if (Network.isServer) {
				player.object.Damage(Mathf.Infinity);
			}
		}
	}
	
	GUILayout.Space(10);
	
	//Options Button
	if (GUILayout.Button("Options", GUILayout.ExpandHeight(true))) {
		optionsShow = true;
		escapeMenu = false;
	}
	
	GUILayout.Space(10);
	
	//Close Menu Button
	if (GUILayout.Button("Close", GUILayout.ExpandHeight(true))) {
		escapeMenu = false;
		optionsShow = false;
		messageBox = false;
	}
	
	GUILayout.EndArea();
}

//Draw Message and Kill feed
function MessageGUI(weight:float) {
	//Extra Skin Settings
	GUI.skin.label.fontSize = tmpFloat - 4;
	GUI.skin.label.alignment = TextAnchor.MiddleCenter;
	GUI.color = Color.white;
	
	//Message Height Calculation
	if (Event.current.type == EventType.Repaint) {
		tmpHeight = 0;
	}
	GUILayout.BeginArea(Rect(0, 0, swidth/4*9/8, sheight/16*5));
	for (ms in Messages) {
		GUILayout.BeginHorizontal();
		GUI.skin.label.wordWrap = false;
		
		GUILayoutUtility.GetRect(GUIContent((ms.Sender + ": ").ToString()), GUI.skin.label, GUILayout.ExpandWidth(false));
		
		GUI.skin.label.wordWrap = true;
		
		if (Event.current.type == EventType.Repaint) {
			tmpHeight += GUILayoutUtility.GetRect(GUIContent((ms.Content).ToString()), GUI.skin.label).height;
		}
		else {
			GUILayoutUtility.GetRect(GUIContent((ms.Content).ToString()), GUI.skin.label);
		}
		GUILayout.EndHorizontal();
	}
	GUILayout.EndArea();
	
	//Message Display
	GUI.skin.label.alignment = TextAnchor.MiddleLeft;
	GUI.color = Color(1, 1, 1, Mathf.Clamp01(weight - ctime)/2);
	GUILayout.BeginArea(Rect(0, 0, swidth/4*9/8, sheight/16*5));
	if (tmpHeight + sheight/16/2 > sheight/16*5) {
		GUILayout.Space(sheight/16*5 - (tmpHeight + sheight/16/2));
	}
	for (ms in Messages) {
		GUILayout.BeginHorizontal();
		GUI.color = ms.color;
		GUI.color.a = weight - ctime;
		GUI.skin.label.wordWrap = false;
		
		GUILayout.Label(ms.Sender + ": ", GUILayout.ExpandWidth(false));
		
		GUI.skin.label.wordWrap = true;
		GUI.color = Color.white;
		GUI.color.a = weight - ctime;
		
		GUILayout.Label(ms.Content, GUILayout.ExpandWidth(false));
		GUILayout.EndHorizontal();
	}
	GUILayout.EndArea();
	
	//Message box Input
	GUI.color = Color.white;
	if (messageBox) {
		escapeMenu = false;
		GUI.FocusControl("1");
		GUI.SetNextControlName("1");
		weight = ctime + 3;
		if (player) {
			messageBoxText = GUI.TextField(Rect(0, sheight/16*5, swidth/4*9/8, sheight/16/2), messageBoxText, 50, GUI.skin.customStyles[1]);
		}
		else {
			messageBoxText = GUI.TextField(Rect(0, sheight/16*5, swidth/4*9/8, sheight/16/2), messageBoxText, 50, GUI.skin.customStyles[1]);
		}
	}
	else {
		if (Input.GetKeyUp(Controls.chat) && !messageBox) {
			messageBoxText = "";
			messageBox = true;
		}
	}
	
	//Killfeed Display
	if (showHUD) {
		GUILayout.BeginArea(Rect(swidth/8*23/4, 0, swidth/4*9/8, sheight));
		GUILayout.BeginVertical();
		for (kfm in KillFeed){
			GUILayout.BeginHorizontal();
			GUILayout.FlexibleSpace();
			GUI.color = kfm.color1;
			GUI.color.a = (kfm.time - ctime);
			GUILayout.Label(kfm.Killer, GUILayout.ExpandWidth(false));
			GUI.color = Color.white;
			GUI.color.a = (kfm.time - ctime);
			GUILayout.Label(" " + kfm.KillWeapon + " ", GUILayout.ExpandWidth(false)); 
			GUI.color = kfm.color2;
			GUI.color.a = (kfm.time - ctime);
			GUILayout.Label(kfm.Killed, GUILayout.ExpandWidth(false));
			GUILayout.EndHorizontal();
		}
		GUILayout.FlexibleSpace();	
		GUILayout.EndVertical();
		GUILayout.EndArea();
	}
	
	GUI.skin.label.fontSize = tmpFloat;
	GUI.skin.label.alignment = TextAnchor.MiddleCenter;
	
	return weight;
}

function ScorebordScreen(weight:float) {
	//Draw All players in a table (Unsorted as of yet)
	GUI.color = Color(1, 1, 1, weight);
    GUI.skin.box.fontSize -= 3;
    GUI.skin.label.fontSize -= 3;
    
	GUI.Box(Rect(swidth/8*9/4, sheight/16, swidth/8*14/4, sheight/16*13*weight), "");
	GUI.BeginGroup(Rect(swidth/8*9/4, sheight/16, swidth/8*14/4, sheight/16*13*weight));
    sheight = sheight/16*13;
    swidth = swidth/8*14/4;
    
    GUI.Box(Rect(0, 0, swidth/7*3, sheight/20), "Username");
    GUI.Box(Rect(swidth/7*3, 0, swidth/7, sheight/20), "Team");
    GUI.Box(Rect(swidth/7*4, 0, swidth/7, sheight/20), "Kills");
    GUI.skin.box.fontSize -= 1;
    GUI.Box(Rect(swidth/7*5, 0, swidth/7, sheight/20), "Deaths");
    GUI.skin.box.fontSize += 1;
    GUI.Box(Rect(swidth/7*6, 0, swidth/7, sheight/20), "Ping");
    
    playerList = networkManager.NPlayers.Values.ToArray();
    SortByKills(playerList);
    
    for (IndexList = 0; IndexList < playerList.length; IndexList++) {
        nPlayer = playerList[IndexList];
        GUI.color = Color.grey;
        if (nPlayer.team == 1) {
            GUI.color = networkManager.BlueColor;
        }
        else if (nPlayer.team == 2) {
            GUI.color = networkManager.GreenColor;
        }
        GUI.color.a = weight;
        GUI.Box(Rect(0, sheight/20 + sheight/20*IndexList, swidth, sheight/20), "");
        
        GUI.color = Color(1, 1, 1, weight);
        GUI.Label(Rect(0, sheight/20 + sheight/20*IndexList, swidth/7*3, sheight/20), nPlayer.username);
        if (nPlayer.team == 1) {
            GUI.Label(Rect(swidth/7*3, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "NPA");
        }
        else if (nPlayer.team == 2) {
            GUI.Label(Rect(swidth/7*3, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "PCD");
        }
        else {
            GUI.Label(Rect(swidth/7*3, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "None");
        }
        GUI.Label(Rect(swidth/7*4, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "" + nPlayer.kills);
        GUI.Label(Rect(swidth/7*5, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "" + nPlayer.deaths);
        GUI.Label(Rect(swidth/7*6, sheight/20 + sheight/20*IndexList, swidth/7, sheight/20), "" + nPlayer.ping);
    }
    
    swidth = Screen.width;
    sheight = Screen.height;
	GUI.EndGroup();
    
    GUI.skin.box.fontSize += 3;
    GUI.skin.label.fontSize += 3;
}

function SortByKills(players:NPlayer[]):NPlayer[] {
    System.Array.Sort.<NPlayer>(players, CompareKills);
}

function CompareKills(X:NPlayer, Y:NPlayer) {
    return Y.kills.CompareTo(X.kills);
}

function HUDGUI(weight:float) {
	GUI.color = Color(0, 0, 0, weight);
	tmpFloat2 = player.object.currentState.aimWeight*sheight/12*player.object.currentWeapon.Sight[player.object.currentWeapon.Addons[0]].VewDistance;
	GUI.DrawTexture(Rect(0, 0, swidth, tmpFloat2), networkManager.White);
	GUI.DrawTexture(Rect(0, sheight - tmpFloat2, swidth, sheight), networkManager.White);
	
	if (showHUD && player.object) {
		if (player.team == 1) {
			GUI.color = networkManager.BlueColor;
		}
		else {
			GUI.color = networkManager.GreenColor;
		}
		for (nPlayer in networkManager.NPlayers.Values) {
			if (nPlayer.object && nPlayer.team == player.team && nPlayer != player) {
				TempVector = player.object.cam.WorldToScreenPoint(nPlayer.object.transform.position + Vector3(0,0.7,0));
				GUI.Label(Rect(TempVector.x - swidth/4/2, sheight - TempVector.y - sheight/4/2, swidth/4, sheight/4), nPlayer.username);
			}
		}
		
		GUI.color = Color(1, 1, 1, weight);
		
		GUI.Box(Rect(swidth/8*10/3, sheight/16*15, swidth/8*8/3, sheight/16), "");
		if (player.object.Health > 50) {
			GUI.color = Color.green;
		}
		else if ((player.object.Health <= 50) && (player.object.Health > 25)) {
			GUI.color = Color.yellow;
		}
		else if (player.object.Health <= 25) {
			GUI.color = Color.red;
		}
		GUI.color.a = weight;
		GUI.DrawTexture(Rect(5 + swidth/8*10/3, 5 + sheight/16*15, (swidth/8*8/3  - 10)/100.0*player.object.Health, sheight/16 - 10), networkManager.White, ScaleMode.StretchToFill);
		GUI.color = Color(1, 1, 1, weight);
		
		
		GUI.Box(Rect(swidth/8*2, sheight/16*14, swidth/8*4/3, sheight/16*2), player.object.currentWeapon.texture);
		GUI.Box(Rect(swidth/8*10/3, sheight/16*14, swidth/8*4/3, sheight/16), player.object.currentWeapon.Clip + "/" + player.object.currentWeapon.Ammo);
		GUI.Label(Rect(swidth/8*2, sheight/16*14, swidth/8*4/3, sheight/16), player.object.currentWeapon.Name);
		GUI.Box(Rect(swidth/8*14/3, sheight/16*14, swidth/8*4/3, sheight/16), "Gx" + player.object.GrenadeAmmo);

        if (damageTimer > ctime) {
            GUI.color = Color(1, 1, 1, Mathf.Clamp01(damageTimer - ctime)*weight);
            GUI.DrawTexture(Rect(-swidth/12, 0, swidth/6, sheight), networkManager.HitTexture, ScaleMode.StretchToFill);
            GUI.DrawTexture(Rect(swidth - swidth/12, 0, swidth/6, sheight), networkManager.HitTexture, ScaleMode.StretchToFill);
            GUI.color = Color(1, 1, 1, weight);
        }
        
		if (networkManager.gameMode == GameModes.KOTH) {
			CPGUI(networkManager.mapInfo.CaptureTheFlagPoint, weight);
		}
		
		//Cursor Drawing
		
		GUI.color = Color(1, 1, 1, weight);
		
	 	if (player.object.weaponReloading) {
	 		GUI.skin.label.fontSize = tmpFloat - 3;
	 		GUI.Label(Rect(Mathf.Lerp(mousePosition.x - 70, swidth*(1-(Mathf.Round(player.object.Soldier.eulerAngles.y)-90)/180)-60, player.object.currentState.aimWeight), Mathf.Lerp(sheight - mousePosition.y - 60, sheight/2-60, player.object.currentState.aimWeight), 140, 40), "Reloading");
	 	}
	 	if (player.object.weaponSwitching) {
	 		GUI.skin.label.fontSize = tmpFloat - 3;
	 		GUI.Label(Rect(Mathf.Lerp(mousePosition.x - 70, swidth*(1-(Mathf.Round(player.object.Soldier.eulerAngles.y)-90)/180)-60, player.object.currentState.aimWeight), Mathf.Lerp(sheight - mousePosition.y - 60, sheight/2-60, player.object.currentState.aimWeight), 140, 40), "Switching");
	 	}
	 	GUI.skin.label.fontSize = tmpFloat;
		GUI.DrawTexture(Rect(Mathf.Lerp(mousePosition.x - 20, swidth*(1-(Mathf.Round(player.object.Soldier.eulerAngles.y)-90)/180)-20, player.object.currentState.aimWeight), Mathf.Lerp(sheight - mousePosition.y - 20, sheight/2-20, player.object.currentState.aimWeight), 40, 40), networkManager.MouseTexture, ScaleMode.ScaleToFit);
		GUI.color = Color(1, 1, 1, (hitMarkerTimer - ctime)*weight);
		GUI.DrawTexture(Rect(Mathf.Lerp(mousePosition.x - 20, swidth*(1-(Mathf.Round(player.object.Soldier.eulerAngles.y)-90)/180)-20, player.object.currentState.aimWeight), Mathf.Lerp(sheight - mousePosition.y - 20, sheight/2-20, player.object.currentState.aimWeight), 40, 40), networkManager.HitMarkerTexture, ScaleMode.ScaleToFit);
	}
}

function CPGUI(cp:CapturePoint, weight:float) {
	weight *= Mathf.Clamp01(1 - (Vector3.Distance(player.object.transform.position, cp.transform.position) - cp.ViewDistance)/cp.ViewDistanceFade);
	TempVector = networkManager.camera.WorldToScreenPoint(cp.transform.position);
	TempVector.y = sheight - TempVector.y;
	TempVector = Vector3(
		Mathf.Clamp(TempVector.x - swidth/10/2, 0, swidth - swidth/10),
		Mathf.Clamp(TempVector.y - sheight/16/2, sheight/16*2, sheight/16*13),
		0
	);
	
	GUI.color = Color(1, 1, 1, weight);
	GUI.Box(Rect(TempVector.x, TempVector.y, swidth/10, sheight/16), cp.name);
	
	GUI.color = Color.black;
	GUI.color += networkManager.BlueColor/100*Mathf.Max(cp.CP, 0);
	GUI.color += networkManager.GreenColor/100*Mathf.Abs(Mathf.Min(cp.CP, 0));
	
	GUI.color.a = weight;
	
	GUI.Label(Rect(TempVector.x, TempVector.y, swidth/10, sheight/16), Mathf.RoundToInt(Mathf.Abs(cp.CP)) + "");
}

function GlobalGUI() {
	GUI.color = Color.white;
	GUI.Box(Rect(swidth/8*9/4, 0, swidth/4*7/8, sheight/16), "");
	GUI.Box(Rect(swidth/8*16/4, 0, swidth/4*7/8, sheight/16), "");
	if (networkManager.gameMode == 0) {
		GUI.color = networkManager.BlueColor;
		GUI.Label(Rect(swidth/8*9/4, 0, swidth/4*7/8, sheight/16), networkManager.team1Kills + "/" + networkManager.targetKills);
		GUI.color = networkManager.GreenColor;
		GUI.Label(Rect(swidth/8*16/4, 0, swidth/4*7/8, sheight/16), networkManager.team2Kills + "/" + networkManager.targetKills);
	}
	else if (networkManager.gameMode == 1) {
		GUI.color = networkManager.BlueColor;
		GUI.Label(Rect(swidth/8*9/4, 0, swidth/4*7/8, sheight/16), networkManager.team1Kills + "/" + networkManager.targetKills);
		GUI.color = networkManager.GreenColor;
		GUI.Label(Rect(swidth/8*16/4, 0, swidth/4*7/8, sheight/16), networkManager.team2Kills + "/" + networkManager.targetKills);
	}
	
	GUI.color = Color(1, 1, 1, killTimer - ctime);
	if (killTimer > ctime && killMessage != "") {
		GUI.Box(Rect(swidth/2 - swidth/8*7/8, sheight/16, swidth/8*7/4, sheight/16), killMessage);
	}
}

/*
===========================
Helper Functions
===========================
*/

//Evaluates Input from the message system
function Eval(evaluation:String[]) {
	if (evaluation.length == 2) {
		if (evaluation[0] == "toggle") {
			if (evaluation[1] == "fps") {
				showFPS = !showFPS;
				return false;
			}
			if (evaluation[1] == "hud") {
				showHUD = !showHUD;
				return false;
			}
		}
		if (evaluation[0] == "kick") {
			if (Network.isServer) {
				for (obj4 in networkManager.NPlayers.Values) {
					if (obj4.username.ToLower() == evaluation[1].ToLower()) {
						Network.CloseConnection(obj4.networkPlayer, true);
						return false;
					}
				}
				SendPMessage(-1, "Cant find player: " + evaluation[1]);
			}
			else {
				SendPMessage(-1, "You are not Host");
			}
			return false;
		}
	}
	else if (evaluation.length == 1) {
		if (evaluation[0] == "suicide") {
			if (player.object) {
				//Damage(10000, -1, "");
				return false;
			}
		}
	}
	return true;
}

//Shows a single input key for changing input settings
//Also haldles inputting and key changing
function KeyField(key:KeyCode, keyName:String) {
	GUILayout.BeginHorizontal();
	GUILayout.Label(keyName);
	GUILayout.FlexibleSpace();
	if(GUILayout.Button("" + key, GUILayout.Width(swidth/8*21/16)) && !detect){
		key = KeyCode.None;
		detect = true;
	}
	else if (detect && key == KeyCode.None) {
		key = Controls.AssignKey(key);
		if (key != KeyCode.None) {
			detect = false;
		}
	}
	GUILayout.EndHorizontal();
	return key;
}

/*
===========================
Extra Functions
===========================
*/

function MouseInRect(rct:Rect) {
	return rct.Contains(Vector2(Input.mousePosition.x, sheight - Input.mousePosition.y));
}

}