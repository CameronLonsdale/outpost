#pragma strict
import System.Collections.Generic;

/*
===========================
Classes
===========================
*/

class QueueItem {
	var timeout:float;
	var networkPlayer:NetworkPlayer;
	
	function QueueItem(np:NetworkPlayer) {
		networkPlayer = np;
		timeout = Time.time + 2;
	}
}

enum ServerStatus {
	inGame,
	winScreen,
	postGame,
	preGame,
	loading,
    none
}

class NetworkServer extends MonoBehaviour {

/*
===========================
Variables
===========================
*/

private var _serverStatus:ServerStatus = ServerStatus.loading;

function get serverStatus():ServerStatus {
	return _serverStatus;
}

function set serverStatus(value:ServerStatus) {
	if (value != _serverStatus && Network.isServer) {
		network.RPC("_SetServerStatus", RPCMode.Others, networkManager.winTeam, parseInt(value));
        Debug.Log("Server: Status sent to: " + value);
		
		//Handle game state implications
		switch (value) {
			case ServerStatus.preGame:
				gameTimer = Time.time + networkManager.startTime;
			break;
			case ServerStatus.winScreen:
				gameTimer = Time.time + networkManager.winTime;
			break;
			case ServerStatus.postGame:
				gameTimer = Time.time + networkManager.postTime;
			break;
			case ServerStatus.loading:
				Application.LoadLevel(1);
			break;
		}
		
		_serverStatus = value;
	}
}

function SetServerStatus(np:NetworkPlayer) {
    if (Network.isServer) {
        network.RPC("_SetServerStatus", np, networkManager.winTeam, parseInt(serverStatus));
        Debug.Log("Server: Status sent to: " + serverStatus);
    }
}

//Connection Queue
private var connectionQueue:List.<QueueItem> = new List.<QueueItem>();
private var networkIdAssign:int = 0;

//Global Timer

//Game timers
private var gameTimer:float;
private var cpTimer:float;

//Network timers
private var networkTimer:float;
private var pingTimer:float;

//Reference
private var networkManager:NetworkManager;
private var network:NetworkView;
private var client:NetworkClient;

//Iteration
private var queueItem:QueueItem;
private var nPlayer:NPlayer;
private var DI:DamageInstance;
private var IndexList:int;
private var IndexList2:int;
private var tmpBool:boolean;
private var vehicle:Vehicle;

//Temp
private var pState:PlayerState;
private var vState:VehicleState;

private var tmpColor:Color;
private var tmpColor2:Color;
private var killerName:String;

private var tmpInput:InputState;
private var cp:CapturePoint;

/*
===========================
Inbuilt Functions
===========================
*/

//Setup
function Awake() {
	//Get references
	networkManager = GetComponent(typeof(NetworkManager)) as NetworkManager;
	network = GetComponent(typeof(NetworkView)) as NetworkView;
	client = GetComponent(typeof(NetworkClient)) as NetworkClient;
	
	serverStatus = ServerStatus.loading;
}

function OnLevelWasLoaded(level:int) {
	if (level > 1) {
		serverStatus = ServerStatus.preGame;
	}
}

function OnPlayerConnected(np:NetworkPlayer) {
	connectionQueue.Add(QueueItem(np));
}

function OnPlayerDisconnected(np:NetworkPlayer) {
	for (nPlayer in networkManager.NPlayers.Values) {
		if (nPlayer.networkPlayer == np) {
			nPlayer.Kill();
			networkManager.NPlayers.Remove(nPlayer.id);
			return;
		}
	}
	
	IndexList = 0;
	for (queueItem in connectionQueue) {
		if (queueItem.networkPlayer == np) {
			connectionQueue.RemoveAt(IndexList);
			return;
		}
		IndexList += 1;
	}
}

function Update() {
	//Independent of status
	if (networkTimer < Time.time) {
			CheckQueue();
	}
	
	if (pingTimer < Time.time) {
		for (nPlayer in networkManager.NPlayers.Values) {
			if (nPlayer.networkPlayer != Network.player && nPlayer.hasPinged) {
				networkManager.NPlayers[nPlayer.id].StartPing();
				network.RPC("_PingRequest", nPlayer.networkPlayer);
			}
		}
		
		pingTimer = Time.time + networkManager.PingUpdateTime;
	}
	
	//inGame
	switch (serverStatus) {
		case ServerStatus.inGame:
			if (networkTimer < Time.time) {
				//Update Vehicles
				IndexList = 0;
				for (vehicle in networkManager.VehicleList) {
					IndexList2 = 0;
					for (slot in vehicle.Slots) {
						if (slot < 0) {
							VehicleUpdate(IndexList, IndexList2, vehicle.Move(IndexList2, new InputState(), 1.0/networkManager.UPS));
						}
						IndexList2 += 1;
					}
					IndexList += 1;
				}
				
				//Update CapturePoints
				if (networkManager.gameMode == GameModes.KOTH) {
					UpdateCP(networkManager.mapInfo.CaptureTheFlagPoint);
					network.RPC("_UpdateCapturePoint", RPCMode.Others, 0, networkManager.mapInfo.CaptureTheFlagPoint.CP);
				}
				else if (networkManager.gameMode == GameModes.CP) {
					IndexList = 0;
					for (cp in networkManager.mapInfo.CapturePointPoints) {
						UpdateCP(cp);
						network.RPC("_UpdateCapturePoint", RPCMode.Others, IndexList, cp.CP);
						IndexList += 1;
					}
				}
			}
			
			if (cpTimer < Time.time) {
				//Update CapturePoints
				if (networkManager.gameMode == GameModes.KOTH) {
					switch (networkManager.mapInfo.CaptureTheFlagPoint.team) {
						case 1:
							networkManager.team1Kills += 1;
						break;
						case 2:
							networkManager.team2Kills += 1;
						break;
					}
					UpdateGameStatus();
				}
				else if (networkManager.gameMode == GameModes.CP) {
					IndexList = 0;
					for (cp in networkManager.mapInfo.CapturePointPoints) {
						switch (networkManager.mapInfo.CaptureTheFlagPoint.team) {
							case 1:
								IndexList += 1;
                            break;
							case 2:
								IndexList -= 1;
							break;
						}
					}
					if (IndexList > 0) {
						networkManager.team1Kills += 1;
					}
					else if (IndexList < 0) {
						networkManager.team2Kills += 1;
					}
					UpdateGameStatus();
				}
				cpTimer = Time.time + 1;
			}
			
			for (nPlayer in networkManager.NPlayers.Values) {
				if (nPlayer.object) {
					if (!nPlayer.object.Active) {
						nPlayer.object.WeaponUpdate(Time.time + nPlayer.GetLatancy());
					}
				}
			}
			
			if (networkManager.CheckForWin()) {
                for (nPlayer in networkManager.NPlayers.Values) {
                    nPlayer.Kill();
                }
				serverStatus = ServerStatus.winScreen;
			}
		break;
        
		case ServerStatus.winScreen:
			if (gameTimer < Time.time) {
                print("?");
                networkManager.SaveGameStats();
				serverStatus = ServerStatus.postGame;
			}
		break;
        
		case ServerStatus.postGame:
			if (gameTimer < Time.time) {
				serverStatus = ServerStatus.loading;
			}
            
            if (networkTimer < Time.time) {
                network.RPC("_SetGameTimer", RPCMode.All, gameTimer - Time.time);
            }
		break;
        
		case ServerStatus.preGame:
			if (gameTimer < Time.time) {
				serverStatus = ServerStatus.inGame;
			}
            
            if (networkTimer < Time.time) {
                network.RPC("_SetGameTimer", RPCMode.All, gameTimer - Time.time);
            }
		break;
        
		case ServerStatus.loading:
			if (!Application.isLoadingLevel) {
				networkManager.LoadLevel();
                networkManager.GetMod();
			}
		break;
	}
	
	if (networkTimer < Time.time) {
		networkTimer = Time.time + 1.0/networkManager.UPS;
	}
}

function OnApplicationQuit() {
    Application.CancelQuit();
    yield networkManager.SaveGameStats();
    Destroy(this);
    Application.Quit();
}

function UpdateCP(cp:CapturePoint) {
    tmpBool = false;
	for (nPlayer in networkManager.NPlayers.Values) {
		if (nPlayer.object) {
			if (Vector3.Distance(nPlayer.object.transform.position, cp.transform.position) < cp.CaptureDistance) {
				if (nPlayer.team == 1) {
					cp.CP += cp.CaptureSpeed;
				}
				else {
					cp.CP -= cp.CaptureSpeed;
				}
                tmpBool = true;
			}
		}
	}
	
	if (cp.team == 0 && cp.CP != 0 && !tmpBool) {
		if (cp.CP > 0) {
			cp.CP -= Mathf.Min(cp.DecapSpeed, cp.CP);
		}
		else {
			cp.CP += Mathf.Max(cp.DecapSpeed, cp.CP);
		}
	}
	
	cp.CP = Mathf.Clamp(cp.CP, -100, 100);
	
	if (cp.CP == 100) {
		cp.team = 1;
	}
	else if (cp.CP == -100) {
		cp.team = 2;
	}
	
	if ((cp.CP <= 0 && cp.team == 1) || (cp.CP >= 0 && cp.team == 2)) {
		cp.team = 0;
	}
}

function UpdateGameStatus() {
	network.RPC("_UpdateGameStatus", RPCMode.Others, networkManager.team1Kills, networkManager.team2Kills);
}

function UpdateGameStatus(np:NetworkPlayer) {
	network.RPC("_UpdateGameStatus", np, networkManager.team1Kills, networkManager.team2Kills);
}

function SetServerData(np:NetworkPlayer) {
    network.RPC("_SetServerData", np, networkManager.respawnTime, networkManager.deathTime, networkManager.gameMode, networkManager.map, networkManager.targetKills);
}

function OnPlayerHealed(id:int, hid:int, amount:float) {
	if (networkManager.NPlayers[id].networkPlayer != Network.player) {
		network.RPC("_HealPlayer", networkManager.NPlayers[id].networkPlayer, amount);
	}
	
	if (id != hid) {
		networkManager.NPlayers[hid].experience += amount;
		if (networkManager.NPlayers[hid].networkPlayer == Network.player) {
			networkManager.client.HealIndication(amount);
		}
		else {
			network.RPC("_HealIndication", networkManager.NPlayers[hid].networkPlayer, amount);
		}
	}
}

function OnPlayerResupplied(id:int, hid:int, amount:int) {
	if (networkManager.NPlayers[id].networkPlayer != Network.player) {
		network.RPC("_ResupplyPlayer", networkManager.NPlayers[id].networkPlayer, amount);
	}
	
	if (id != hid) {
		networkManager.NPlayers[hid].experience += amount;
		if (networkManager.NPlayers[hid].networkPlayer == Network.player) {
			networkManager.client.ResupplyIndication(amount);
		}
		else {
			network.RPC("_ResupplyIndication", networkManager.NPlayers[hid].networkPlayer, amount);
		}
	}
}

function OnPlayerDamaged(id:int, kid:int, amount:float, weapon:String) {
	if (networkManager.NPlayers[id].networkPlayer != Network.player) {
		network.RPC("_DamagePlayer", networkManager.NPlayers[id].networkPlayer, amount);
	}
	
	if (id != kid && kid >= 0) {
		if (networkManager.NPlayers[kid].networkPlayer == Network.player) {
			networkManager.client._HitMarker(amount);
		}
		else {
			network.RPC("_HitMarker", networkManager.NPlayers[kid].networkPlayer, amount);
		}
	}
}

function OnPlayerKilled(id:int, kid:int, multi:float, weapon:String) {
	network.RPC("_KillPlayer", RPCMode.Others, id, kid, weapon);
	
	//wait for ping time of killed player
	networkManager.NPlayers[id].object.Dead = true;
	yield WaitForSeconds(networkManager.NPlayers[id].latancy);
	
	//Kill player
	networkManager.HandleKill(id, kid, weapon);
	
	if (id != kid && kid >= 0) {
		networkManager.NPlayers[id].object.CompileDamages();
		for (DI in networkManager.NPlayers[id].object.damageInstances) {
			DI.amount = Mathf.Clamp(DI.amount, 0, 100);
			if (networkManager.NPlayers[DI.id]) {
				if (networkManager.NPlayers[DI.id].networkPlayer == Network.player) {
					networkManager.client.AssistNotification(id, DI.amount);
				}
				else {
					network.RPC("_AssistNotification", networkManager.NPlayers[DI.id].networkPlayer, id, Mathf.RoundToInt(DI.amount));
				}
				networkManager.NPlayers[DI.id].experience += Mathf.RoundToInt(DI.amount);
			}
		}
		
		networkManager.NPlayers[kid].experience += 100;
		if (networkManager.NPlayers[kid].networkPlayer == Network.player) {
			networkManager.client.KillNotification(id);
		}
		else {
			network.RPC("_KillNotification", networkManager.NPlayers[kid].networkPlayer, id);
		}
	}
	
	networkManager.KillPlayer(id);
	KillFeedMessage(id, kid, multi, weapon);
}

function OnVehicleDamaged(index:int, kid:int, amount:float, weapon:String) {
	network.RPC("_DamageVehicle", RPCMode.Others, index, amount);
	
	if (!(kid in networkManager.VehicleList[index].Slots) && kid >= 0) {
		if (networkManager.NPlayers[kid].networkPlayer == Network.player) {
			networkManager.client._HitMarker(amount);
		}
		else {
			network.RPC("_HitMarker", networkManager.NPlayers[kid].networkPlayer, amount);
		}
	}
}

function OnVehicleKilled(index:int, kid:int, multi:float, weapon:String) {
	//Kill vehicle
	network.RPC("_KillVehicle", RPCMode.Others, index);
	//Kill players in vehicle
	for (IndexList in networkManager.VehicleList[index].Slots) {
		if (IndexList >= 0) {
			if (networkManager.NPlayers[IndexList].object) {
				networkManager.NPlayers[IndexList].object.Damage(kid, Mathf.Infinity, multi, weapon);
			}
		}
	}
	
	//Send kill/assist notifications
	if (!(kid in networkManager.VehicleList[index].Slots) && kid >= 0) {
		networkManager.VehicleList[index].CompileDamages();
		for (DI in networkManager.VehicleList[index].damageInstances) {
			DI.amount = Mathf.Clamp(DI.amount, 0, 100);
			if (networkManager.NPlayers[DI.id]) {
				if (networkManager.NPlayers[DI.id].networkPlayer == Network.player) {
					networkManager.client.VehicleAssistNotification(index, DI.amount);
				}
				else {
					network.RPC("_VehicleAssistNotification", networkManager.NPlayers[DI.id].networkPlayer, index, Mathf.RoundToInt(DI.amount));
				}
				networkManager.NPlayers[DI.id].experience += Mathf.RoundToInt(DI.amount);
			}
		}
		
		networkManager.NPlayers[kid].experience += 100;
		if (networkManager.NPlayers[kid].networkPlayer == Network.player) {
			networkManager.client.VehicleKillNotification(index);
		}
		else {
			network.RPC("_VehicleKillNotification", networkManager.NPlayers[kid].networkPlayer, index);
		}
	}
	
	networkManager.KillVehicle(index);
}

function OnPlayerFire(id:int) {
	for (nPlayer in networkManager.NPlayers.Values) {
		if (nPlayer.object) {
            if (nPlayer.id == id) {
                nPlayer.object.ApplyLagState(Time.time);
            }
            else {
                nPlayer.object.ApplyLagState(Time.time - (nPlayer.GetLatancy() + networkManager.NPlayers[id].GetLatancy()));
            }
		}
		
		if (nPlayer.id != id && nPlayer.networkPlayer != Network.player) {
			network.RPC("_PlayerShoot", nPlayer.networkPlayer, id);
		}
	}
}

function OnPlayerReload(id:int) {
	for (nPlayer in networkManager.NPlayers.Values) {
		if (nPlayer.id != id && nPlayer.networkPlayer != Network.player) {
			network.RPC("_PlayerReload", nPlayer.networkPlayer, id);
		}
	}
}

/*
===========================
RPC's
===========================
*/

@RPC
function _RequestServerData(info:NetworkMessageInfo) {
    if (Network.isServer) {
        SetServerData(info.sender);
    }
}

@RPC
function _UpdateInput(id:int, lookAngle:float, horizontal:float, vertical:float, crouch:float, rotation:float, sprint:boolean, jump:boolean, ladder:boolean, aim:float, swap:int, info:NetworkMessageInfo) {
	if (id in networkManager.NPlayers && (networkManager.NPlayers[id].networkPlayer == info.sender || info.sender + "" == "-1") && Network.isServer) {
		//Regenerate Input from client
		tmpInput = new InputState();
		
		tmpInput.horizontal = Mathf.Clamp(horizontal, -1, 1);
		tmpInput.vertical = Mathf.Clamp(vertical, -1, 1);
		
		tmpInput.crouch = Mathf.Clamp(crouch, -1, 1);
		tmpInput.rotation = Mathf.Clamp(rotation, -1, 1);
		
		tmpInput.sprint = sprint;
		tmpInput.jump = jump;
		tmpInput.ladder = ladder;
		
		tmpInput.switchTo = Mathf.Clamp(swap, 0, 1);
		
		UpdateInput(tmpInput, id);
		
		if (!networkManager.NPlayers[id].vehicle) {
			networkManager.NPlayers[id].object.nextState.lookAngle = Mathf.Clamp(lookAngle, 0, 180);
			networkManager.NPlayers[id].object.nextState.aimWeight = Mathf.Clamp(aim, -1, 1);
		}
	}
}

@RPC
function _PingReply(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id] && (networkManager.NPlayers[id].networkPlayer == info.sender) && Network.isServer) {
		networkManager.NPlayers[id].StopPing();
		
		if (networkManager.NPlayers[id].ping > networkManager.maxPing) {
			networkManager.KickPlayer(networkManager.NPlayers[id].networkPlayer, "Ping exceeds " + networkManager.maxPing);
			return;
		}
		else {
			network.RPC("_UpdateLatancy", RPCMode.Others, networkManager.NPlayers[id].latancy);
		}
	}
}

@RPC
function _RequestUpdate(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id] && (networkManager.NPlayers[id].networkPlayer == info.sender) && Network.isServer) {
		networkManager.UpdatePlayer(info.sender);
	}
}

@RPC
function _PlayerConnect(username:String, code:String, info:NetworkMessageInfo) {
	if (!Network.isServer) {
        return;
    }
	
	var done:boolean = false;
	for (IndexList = 0; IndexList < connectionQueue.Count; IndexList += 1) {
		if (connectionQueue[IndexList].networkPlayer == info.sender) {
			connectionQueue.RemoveAt(IndexList);
			done = true;
			break;
		}
	}
	if (!done) {
		networkManager.KickPlayer(info.sender, "Player was not in connection queue");
        return;
	}
	
	//Confirm username matches secure code
	if (!Settings.offline) {
        try {
            var www:WWW = new WWW(Settings.backend + "/v1/auth/confirm?username=" + username + "&secure_code=" + code);
        }
        catch (err) {
            networkManager.KickPlayer(info.sender, "Could not connect to outpostsoftware.com");
            return;
        }
        
        yield www;
        
        if (!String.IsNullOrEmpty(www.error)) {
            Debug.Log(www.error);
            networkManager.KickPlayer(info.sender, "Could not connect to outpostsoftware.com");
            return;
        }
        
        var message:BackendMessage = BackendMessage(www.text);
        
        if (message.isError) {
            networkManager.KickPlayer(info.sender, message.message[0]);
            return;
        }
    }
	
	//all security layers passed, connect player now
	networkManager.UpdatePlayer(info.sender);
	nPlayer = AddPlayer(info.sender, username, code);
    SetServerStatus(info.sender);
    UpdateGameStatus(info.sender);
	SetServerData(info.sender);
	
	//Send Player character information
	
	/*try {
		var wwwPlayerInfo:WWW = new WWW("api.outpostsoftware.com/v1/outpost/characters/get_info?username=" + username + "&secure_code=" + code);
	}
	catch (err) {
		networkManager.Disconnect("Lost connection to Outpost Software API");
		return;
	}
	
	yield wwwPlayerInfo;
	
	try {
		if (wwwPlayerInfo.text) {
			if (wwwPlayerInfo.text.Trim() == "fail") {
				networkManager.KickPlayer(info.sender, "Server has lost connection to API");
				return;
			}
			else {
				nPlayer.characterStats = CharacterStats(wwwPlayerInfo.text);
			}
		}
	}
	catch (err) {
		networkManager.KickPlayer(info.sender, "Server has lost connection to API");
		return;
	}*/
	//nPlayer.characterStats = CharacterStats(username, 0);
	//network.RPC("_SetCharacterStats", info.sender, nPlayer.characterStats.name, nPlayer.characterStats.gender.ToString());
}

@RPC
function _JoinRequest(id:int, team:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender || info.sender + "" == "-1" && Network.isServer) {
		JoinRequest(id, team);
	}
}

@RPC
function _SpawnRequest(id:int, main:int, secondary:int, ma1:int, ma2:int, ma3:int, sa1:int, sa2:int, sa3:int, g:int, info:NetworkMessageInfo) {
	if ((networkManager.NPlayers[id].networkPlayer == info.sender || info.sender + "" == "-1") && Network.isServer) {
		//Security
		if (main >= 0 && main < Loadout.gunsMain.length) {
		if (secondary >= 0 && secondary < Loadout.gunsSecondary.length) {
			if (ma1 >= 0 && ma1 < Loadout.gunsMain[main].Sight.length) {
			if (ma2 >= 0 && ma2 < Loadout.gunsMain[main].Front.length) {
			if (ma3 >= 0 && ma3 < Loadout.gunsMain[main].Under.length) {
				if (sa1 >= 0 && sa1 < Loadout.gunsSecondary[secondary].Sight.length) {
				if (sa2 >= 0 && sa2 < Loadout.gunsSecondary[secondary].Front.length) {
				if (sa3 >= 0 && sa3 < Loadout.gunsSecondary[secondary].Under.length) {
					SpawnRequest(id, main, secondary, ma1, ma2, ma3, sa1, sa2, sa3, g);
				}}}
			}}}
		}}
	}
}

@RPC
function _LeaveRequest(id:int, info:NetworkMessageInfo) {
	if ((networkManager.NPlayers[id].networkPlayer == info.sender || info.sender + "" == "-1") && Network.isServer) {
        if (networkManager.NPlayers[id].object) {
			networkManager.NPlayers[id].object.Damage(Mathf.Infinity);
		}
		network.RPC("_LeavePlayer", RPCMode.All, id);
	}
}

@RPC
function _PlayerFireRequest(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender && Network.isServer) {
		if (networkManager.NPlayers[id].object) {
			if (!networkManager.NPlayers[id].vehicle) {
				if (networkManager.NPlayers[id].object.WeaponInput(Time.time + networkManager.NPlayers[id].GetLatancy())) {
					OnPlayerFire(id);
				}
			}
			else {
				if (networkManager.NPlayers[id].vehicle.WeaponInput(networkManager.NPlayers[id].vehicleSlot, Time.time + networkManager.NPlayers[id].GetLatancy())) {
					OnPlayerFire(id);
				}
			}
		}
	}
}

@RPC
function _SuicideRequest(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender && Network.isServer) {
		if (networkManager.NPlayers[id].object) {
			networkManager.NPlayers[id].object.Damage(Mathf.Infinity);
		}
	}
}

@RPC
function _GrenadeThrowRequest(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender && Network.isServer) {
		if (networkManager.NPlayers[id].object) {
			networkManager.NPlayers[id].object.ThrowGrenade();
		}
	}
}

@RPC
function _RequestReload(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender && networkManager.NPlayers[id].object && Network.isServer) {
		networkManager.NPlayers[id].object.WeaponStartReload(Time.time + networkManager.NPlayers[id].GetLatancy());
	}
}

@RPC
function _VehicleToggleInput(id:int, info:NetworkMessageInfo) {
	if (networkManager.NPlayers[id].networkPlayer == info.sender && Network.isServer) {
		VehicleToggleInput(id);
	}
}

/*
===========================
Helper Functions
===========================
*/

function JoinRequest(id:int, team:int) {
    network.RPC("_JoinPlayer", RPCMode.All, id, team);
}

function VehicleToggleInput(id:int) {
	if (networkManager.NPlayers[id].vehicle) {
		PlayerLeaveVehicle(id);
	}
	else {
		PlayerEnterVehicle(id);
	}
}

function PlayerEnterVehicle(id:int) {
	IndexList = 0;
	for (vehicle in networkManager.VehicleList) {
		if (vehicle.CheckInBounds(networkManager.NPlayers[id].object.transform.position)) {
			if (vehicle.PlayerEnter(id)) {
				networkManager.NPlayers[id].vehicle = vehicle;
				
				network.RPC("_VehiclePlayerEnter", RPCMode.Others, id, IndexList);
			}
		}
		IndexList += 1;
	}
}

function PlayerLeaveVehicle(id:int) {
	if (networkManager.NPlayers[id].vehicle) {
		networkManager.NPlayers[id].vehicle.PlayerLeave(id);
		networkManager.NPlayers[id].vehicle = null;
		network.RPC("_VehiclePlayerExit", RPCMode.Others, id);
	}
}

function VehicleUpdate(index:int, slot:int, state:VehicleState) {
	network.RPC("_VehicleUpdate", RPCMode.Others, index, slot, state.position, state.rotation, state.lookAngle);
}

function KillFeedMessage(id:int, kid:int, multi:float, weapon:String) {
	if (weapon == "") {
		weapon = "killed";
	}
	
	if (networkManager.NPlayers[id].team == 1) {
		tmpColor2 = networkManager.BlueColor;
	}
	else {
		tmpColor2 = networkManager.GreenColor;
	}
	
	if (id == kid) {
		killerName = "Opted Out";
		tmpColor = Color.grey;
	}
	else if (kid == -1) {
		killerName = "Server";
		tmpColor = Color.red;
	}
	else if (kid == -2) {
		killerName = "Natural Causes";
		tmpColor = Color.grey;
	}
	else {
		killerName = networkManager.NPlayers[kid].username;
		
		if (networkManager.NPlayers[kid].team == 1) {
			tmpColor = networkManager.BlueColor;
		}
		else {
			tmpColor = networkManager.GreenColor;
		}
	}
	
	network.RPC("_KillFeedMessage", RPCMode.All, killerName, weapon, networkManager.NPlayers[id].username, 
		tmpColor.r, tmpColor.g, tmpColor.b,
		tmpColor2.r, tmpColor2.g, tmpColor2.b
	);
}

function SpawnRequest(id:int, main:int, secondary:int, ma1:int, ma2:int, ma3:int, sa1:int, sa2:int, sa3:int, g:int) {
	if (!networkManager.NPlayers[id].object) {
		Random.seed = Time.time;
		network.RPC("_SpawnPlayer", RPCMode.All, id, GetSpawn(id), Random.Range(1, 10000), main, secondary, ma1, ma2, ma3, sa1, sa2, sa3, g);
	}
}

function UpdateInput(input:InputState, id:int) {
	if (!networkManager.NPlayers[id].vehicle) {
		pState = networkManager.NPlayers[id].object.Move(input, 1.0/networkManager.UPS);
		
		network.RPC("_UpdatePlayer", RPCMode.Others, id, pState.position, pState.rotation, pState.grounded, pState.lookAngle, pState.selectionWeight, pState.crouchWeight, pState.standWeight, pState.animationState, pState.aimWeight, pState.selected);
	}
	else {
		vState = networkManager.NPlayers[id].vehicle.Move(networkManager.NPlayers[id].vehicleSlot, input, 1.0/networkManager.UPS);
		VehicleUpdate(networkManager.NPlayers[id].vehicle.index, networkManager.NPlayers[id].vehicleSlot, vState);
	}
}

function AddPlayer(np:NetworkPlayer, username:String, code:String) {
	networkManager.NPlayers[networkIdAssign] = new NPlayer(np, networkIdAssign, username, code);
	network.RPC("_AddPlayer", RPCMode.Others, np, networkIdAssign, username);
	networkIdAssign += 1;
	return networkManager.NPlayers[networkIdAssign - 1];
}

function CheckQueue() {
	IndexList = 0;
	for (queueItem in connectionQueue) {
		if (queueItem.timeout < Time.time) {
			networkManager.KickPlayer(queueItem.networkPlayer, "Connection timed out");
			connectionQueue.RemoveAt(IndexList);
		}
		IndexList += 1;
	}
}

function GetSpawn(id:int) {
	if (networkManager.gameMode == 0 || networkManager.gameMode == 1) {
		var spawn:Transform = networkManager.mapInfo.RandomSpawns[parseInt(Random.Range(0, networkManager.mapInfo.RandomSpawns.length-1))];
		IndexList = 0;
		for (var obj:Transform in networkManager.mapInfo.RandomSpawns) {
			for (var pl:NPlayer in networkManager.NPlayers.Values) {
				if (pl.team != networkManager.NPlayers[id].team && pl.object) {
					if (Vector3.Distance(obj.position, pl.object.transform.position) > IndexList) {
						IndexList = Vector3.Distance(obj.position, pl.object.transform.position);
						spawn = obj;
					}
				}
			}
		}
	}
	else if (networkManager.gameMode == 2) {
        var epochStart:DateTime = new System.DateTime(1970, 1, 1, 8, 0, 0, System.DateTimeKind.Utc);
        Random.seed = (System.DateTime.UtcNow - epochStart).TotalSeconds;
		if (networkManager.NPlayers[id].team == 1) {
			spawn = networkManager.mapInfo.Team1Spawns[Random.Range(0, networkManager.mapInfo.Team1Spawns.length)];
		}
		else {
			spawn = networkManager.mapInfo.Team2Spawns[Random.Range(0, networkManager.mapInfo.Team2Spawns.length)];
		}
	}
	
	return spawn.position;
}

}