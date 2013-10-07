#pragma strict
#pragma downcast
import System.Collections.Generic;

/*
===========================
Classes
===========================
*/

enum GameModes {
	TDM = 0, 
	KOTH = 1, 
	GunGame = 2, 
	Arena = 3, 
	CP = 4
};

enum Genders {
	male = 0, 
	female = 1
};

//Single Player stats instance
class CharacterStats {
	var name:String;
	var gender:int = 0;
	var level:int;
	var experience:int;
	
	function CharacterStats(n:String, g:int, l:int, e:int) {
		name = n;
		gender = g;
		level = l;
		experience = e;
	}
	
	function CharacterStats(parse:String) {
		var input:String[] = parse.Trim().Split("`"[0]);
		name = input[0];
		gender = parseInt(input[1]);
	}
}

//Single player on the network
class NPlayer {
	var networkPlayer:NetworkPlayer;
	
	var id:int;
	var username:String;
	var secureCode:String;
	var characterStats:CharacterStats;
	var team:int;
	
	var kills:int;
	var deaths:int;
	var experience:int = 0;
	
	var respawnTimer:float;
	var killCamTimer:float;
	
	var object:Player;
	var vehicle:Vehicle;
	var vehicleSlot:int;
	
	//Network Stats
	var latancy:float;
	private var pinged = true;
	private var latancyUpdateSend:float;
	
	function NPlayer(np:NetworkPlayer, ident:int, name:String, code:String) {
		networkPlayer = np;
		
		id = ident;
		this.username = name;
		secureCode = code;
		team = 0;
		
		kills = 0;
		deaths = 0;
		
		respawnTimer = 0;
		
		object = null;
		
		latancyUpdateSend = Time.time;
	}
	
	function Spawn(position:Vector3, PlayerPrefab:Transform, nm:NetworkManager, seed:int, main:int, secondary:int, mainAddons:int[], secondaryAddons:int[], grenade:int) {
		object = GameObject.Instantiate(PlayerPrefab, position, Quaternion.identity).GetComponent(typeof(Player)) as Player;
		object.networkManager = nm;
		object.NetId = id;
		object.seed = seed;
		
		//Security
		object.SetEquipped(main, secondary, mainAddons, secondaryAddons, grenade);
		return object;
	}
	
	function Kill() {
		if (vehicle) {
			vehicle.PlayerLeave(id);
			vehicle = null;
		}
		if (object) {
			object.Kill();
		}
	}
	
	function get ping():int {
		return Mathf.RoundToInt(latancy*1000);
	}
	
	function get hasPinged():boolean {
		return pinged;
	}
	
	function StartPing() {
		latancyUpdateSend = Time.time;
		pinged = false;
	}
	
	function StopPing() {
		latancy = (Time.time - latancyUpdateSend)/2;
		pinged = true;
	}
	
	function ToString() {
		return "NPlayers - id:" + id + ", username:" + username + ", team:" + team + ", object:" + (object != null);
	}
}


class NetworkManager extends MonoBehaviour {
/*
===========================
Variables
===========================
*/

//Global Settings
var UPS:int;
var PingUpdateTime:float;
var PlayerPrefab:Transform;

var BulletHits:Transform[];
var ShootEffects:Transform[];
var Bullets:Projectile[];

var PlayerObjects:DynamicNetworkObject[];

var Vehicles:Vehicle[];

var BulletLayerMask:LayerMask;
var EnvironmentLayerMask:LayerMask;

var AudioPrefab:Transform;

//GUI References
var CustomSkin:GUISkin;
var White:Texture;
var HitTexture:Texture;

var MouseTexture:Texture;
var HitMarkerTexture:Texture;

var FlagBlue:Texture;
var FlagGreen:Texture;
var ArrowTexture:Texture;
var ArrowTexture2:Texture;

var BlueColor:Color;
var GreenColor:Color;

//Network Settings
@System.NonSerialized
var startTime:float = 5;
@System.NonSerialized
var postTime:float = 10;
@System.NonSerialized
var respawnTime:float = 5;
@System.NonSerialized
var deathTime:float = 3;
@System.NonSerialized
var winTime:float = 4;
@System.NonSerialized
var gameMode:int = 1;
@System.NonSerialized
var map:int = 0;
@System.NonSerialized
var maxPing:int = 1000;

//Game Stats
@System.NonSerialized
var winTeam:int;
@System.NonSerialized
var targetKills:int = 10;

//Game stats
private var statsSaved:boolean = false;

@System.NonSerialized
var team1Kills:int = 0;
@System.NonSerialized
var team2Kills:int = 0;
@System.NonSerialized
var team1Deaths:int = 0;
@System.NonSerialized
var team2Deaths:int = 0;
@System.NonSerialized
var gameStartTime:float;

//Hashtable for all players on the network
var NPlayers:Dictionary.<int, NPlayer>;

var DynamicObjects:List.<DynamicNetworkObject>;
private var dnobj:DynamicNetworkObject;
private var snobj:StaticNetworkObject;

var VehicleList:List.<Vehicle>;
private var vehicle:Vehicle;

private var networkIdAssign:int = 0;

//Reference Variables
@System.NonSerialized
var network:NetworkView;
@System.NonSerialized
var client:NetworkClient;
@System.NonSerialized
var server:NetworkServer;

private var _mapInfo:MapInfo;
function get mapInfo():MapInfo {
    if (!_mapInfo) {
        _mapInfo = FindObjectOfType(typeof(MapInfo)) as MapInfo;
    }
    return _mapInfo;
}

//Iteration
private var nPlayer:NPlayer;
private var pl:Player;
private var ld:Ladder;

private var IndexList:int;

private var networkTimer:float;

function get isClient():boolean {
	return client.enabled;
}

function get isServer():boolean {
	return server.enabled;
}

/*
===========================
Inbuilt Functions
===========================
*/

//Setup
function Awake() {
	//Set Lists
	NPlayers = new Dictionary.<int, NPlayer>();
	DynamicObjects = new List.<DynamicNetworkObject>();
	
	//Setup
	network = GetComponent(typeof(NetworkView)) as NetworkView;
	_mapInfo = FindObjectOfType(typeof(MapInfo)) as MapInfo;
}

function OnLevelWasLoaded(level:int) {
	if (level > 1) {
		IndexList = 0;
		for (snobj in mapInfo.StaticNetworkObjects) {
			snobj.netMan = this;
			snobj.index = IndexList;
			IndexList += 1;
		}
		
		for (IndexList = 0; IndexList < mapInfo.VehicleSpawnPoints.length; IndexList += 1) {
			mapInfo.VehicleSpawnPoints[IndexList].networkManager = this;
		}
		
		if (Network.isClient && client.authenticated) {
			network.RPC("_RequestUpdate", RPCMode.Server, client.NetId);
		}
	}
	if (level == 0) {
		Destroy(gameObject);
	}
}

function Update() {
	client = GetComponent(typeof(NetworkClient)) as NetworkClient;
	server = GetComponent(typeof(NetworkServer)) as NetworkServer;
	
	if (networkTimer < Time.time) {
		for (dnobj in DynamicObjects) {
            if (dnobj) {
                network.RPC("_DynamicObjectUpdate", RPCMode.Others, dnobj.index, dnobj.transform.position, dnobj.transform.rotation);
            }
		}
		
		networkTimer = Time.time + 1.0/UPS;
	}
}

/*
===========================
RPC's
===========================
*/

@RPC
function _SpawnPlayer(id:int, position:Vector3, seed:int, main:int, secondary:int, ma1:int, ma2:int, ma3:int, sa1:int, sa2:int, sa3:int, g:int, info:NetworkMessageInfo) {
	if (info.sender.ToString() == "-1" || info.sender == Network.connections[0]) {
		SpawnPlayer(id, position, seed, main, secondary, [ma1, ma2, ma3], [sa1, sa2, sa3], g);
	}
}

@RPC
function _JoinPlayer(id:int, team:int, info:NetworkMessageInfo) {
	if (info.sender.ToString() == "-1" || info.sender == Network.connections[0]) {
		NPlayers[id].team = team;
	}
}

@RPC
function _LeavePlayer(id:int, info:NetworkMessageInfo) {
	if (info.sender.ToString() == "-1" || info.sender == Network.connections[0]) {
		LeavePlayer(id);
	}
}


//Dynamic Objects
@RPC
function _InstantiateDynamic(id:int, type:int, pos:Vector3, rot:Quaternion, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		InstantiateDynamic(id, type, pos, rot);
	}
}

@RPC
function _DynamicObjectUpdate(index:int, pos:Vector3, rotation:Quaternion, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		if (index < DynamicObjects.Count) {
			DynamicObjects[index].Pos = pos;
			DynamicObjects[index].StartPos = DynamicObjects[index].transform.position;
			DynamicObjects[index].Rot = rotation;
			DynamicObjects[index].StartRot = DynamicObjects[index].transform.rotation;
			DynamicObjects[index].StartTime = Time.time;
		}
	}
}

@RPC
function _DynamicObjectDeath(index:int, pid:int, info:NetworkMessageInfo) {
	if (info.sender.ToString() == "-1" || info.sender == Network.connections[0]) {
		if (pid != -1) {
			DynamicObjects[index].Kill(pid);
		}
		else {
			DynamicObjects[index].Vanish();
		}
		
		IndexList = index+1;
		while (IndexList < DynamicObjects.Count) {
			DynamicObjects[IndexList].index -= 1;
			IndexList += 1;
		}
		DynamicObjects.RemoveAt(index);
	}
}

//Static Objects
@RPC
function _StaticObjectDeath(index:int, info:NetworkMessageInfo) {
	if (info.sender.ToString() == "-1" || info.sender == Network.connections[0]) {
		if (index < mapInfo.StaticNetworkObjects.length && mapInfo.StaticNetworkObjects[index]) {
			mapInfo.StaticNetworkObjects[index].Kill();
		}
	}
}


//Vehicles
@RPC
function _VehicleSpawn(type:int, position:Vector3, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		SpawnVehicle(type, position);
	}
}

@RPC
function _KillVehicle(index:int, info:NetworkMessageInfo) {
	if (info.sender == Network.connections[0]) {
		KillVehicle(index);
	}
}

/*
===========================
Helper Functions
===========================
*/

function SpawnVehicle(type:int, position:Vector3) {
	vehicle = Instantiate(Vehicles[type], position, Quaternion.identity) as Vehicle;
	vehicle.networkManager = this;
	vehicle.index = VehicleList.Count;
	vehicle.type = type;
	
	VehicleList.Add(vehicle);
	
	if (Network.isServer) {
		network.RPC("_VehicleSpawn", RPCMode.Others, type, position);
	}
	
	return vehicle;
}

function InstantiateDynamic(id:int, type:int, pos:Vector3, rot:Quaternion) {
	dnobj = Instantiate(PlayerObjects[type], pos, rot);
	dnobj.netMan = this;
	dnobj.index = DynamicObjects.Count;
	dnobj.id = id;
	dnobj.type = type;
	dnobj.team = NPlayers[id].team;
	
	if (Network.isServer) {
		network.RPC("_InstantiateDynamic", RPCMode.Others, id, type, pos, rot);
	}
	
	DynamicObjects.Add(dnobj);
	return dnobj;
}

function SpawnPlayer(id:int, position:Vector3, seed:int, main:int, secondary:int, mainAddons:int[], secondaryAddons:int[], grenade:int) {
	NPlayers[id].Spawn(position, PlayerPrefab, this, seed, main, secondary, mainAddons, secondaryAddons, grenade);
}

function UpdatePlayer(np:NetworkPlayer) {
	//Update Objects
	IndexList = 0;
	for (snobj in mapInfo.StaticNetworkObjects) {
		if (!snobj) {
			network.RPC("_StaticObjectDeath", np, IndexList);
		}
		IndexList += 1;
	}
	
	//Update Vehicles
	for (vehicle in VehicleList) {
		network.RPC("_VehicleSpawn", np, vehicle.type, vehicle.transform.position);
	}
	
	//Update Players
	for (nPlayer in NPlayers.Values) {
        network.RPC("_AddPlayer", np, Network.player, nPlayer.id, nPlayer.username);
        
        if (nPlayer.team != 0) {
            network.RPC("_JoinPlayer", np, nPlayer.id, nPlayer.team);
        }
        if (nPlayer.object) {
            network.RPC("_SpawnPlayer", np, nPlayer.id, nPlayer.object.currentState.position, nPlayer.object.seed, 
                nPlayer.object.equipped[0].index, nPlayer.object.equipped[1].index, 
                nPlayer.object.equipped[0].Addons[0], 
                nPlayer.object.equipped[0].Addons[1], 
                nPlayer.object.equipped[0].Addons[2], 
                nPlayer.object.equipped[1].Addons[0], 
                nPlayer.object.equipped[1].Addons[1], 
                nPlayer.object.equipped[1].Addons[2],
                nPlayer.object.GrenadeType
            );
        }
        if (nPlayer.vehicle) {
            network.RPC("_VehiclePlayerEnter", nPlayer.id, nPlayer.vehicle.index);
        }
	}
}

function KillPlayer(id:int) {
    NPlayers[id].deaths += 1;
    if (NPlayers[id].team == 1) {
        team1Deaths += 1;
    }
    else {
        team2Deaths += 1;
    }
	NPlayers[id].Kill();
}

function LeavePlayer(id:int) {
	NPlayers[id].team = 0;
}

function Disconnect() {
	Disconnect("");
}

function Disconnect(str:String) {
    if (Network.isServer) {
        SaveGameStats();
    }
	Network.Disconnect(200);
	Application.LoadLevel(0);
}

function LoadLevel() {
	Application.LoadLevelAsync(map + 2);
}

function CheckLadder(id:int) {
    if (mapInfo) {
	for (ld in mapInfo.Ladders) {
        if (id in NPlayers && NPlayers[id].object) {
		if (Mathf.Abs(NPlayers[id].object.transform.position.x - ld.Top.position.x) < 0.6) {
		if (NPlayers[id].object.transform.position.y > ld.Bottom.position.y) {
		if (NPlayers[id].object.transform.position.y < ld.Top.position.y) {
			return ld;
		}
		}
		}
        }
	}
    }
	
	return null;
}

function GetHealthRegen(point:Vector3) {
	return 0.0;
}

function GetAmmoRegen(point:Vector3) {
	return 0.0;
}

function HandleKill(id:int, kid:int, weapon:String) {
	if (id != kid) {
		if (kid >= 0) {
			NPlayers[kid].kills += 1;
			
			if (NPlayers[kid].team == 1) {
				team1Kills += 1;
			}
			else {
				team2Kills += 1;
			}
		}
	}
	
	if (isClient && id == client.NetId) {
		if (kid == id) {
			client.playerKill = "s";
		}
		else if (kid >= 0) {
			client.playerKill = NPlayers[kid].username;
			client.weaponKill = weapon;
		}
		else if (kid == -2) {
			client.playerKill = "n";
		}
		else {
			client.playerKill = "Server";
			client.weaponKill = "Valve Ban Hammer";
		}
	}
	
	NPlayers[id].respawnTimer = Time.time + deathTime + respawnTime;
	NPlayers[id].killCamTimer = Time.time + deathTime;
}

function CheckVehicles(point:Vector3) {
	for (vehicle in VehicleList) {
		if (vehicle.CheckInBounds(point)) {
			return vehicle;
		}
	}
	return null;
}

function KillVehicle(index:int) {
	VehicleList[index].Kill();
	VehicleList.RemoveAt(index);
}

function CheckForWin() {
	if (gameMode == GameModes.TDM || gameMode == GameModes.KOTH || gameMode == GameModes.CP) {
		if (team1Kills >= targetKills) {
			winTeam = 1;
			return true;
		}
		else if (team2Kills >= targetKills) {
			winTeam = 2;
			return true;
		}
	}
	return false;
}

function KickPlayer(player:NetworkPlayer, message:String) {
    Debug.Log(message);
    network.RPC("_DisconnectMessage", player, message);
    Network.CloseConnection(player, true);
}

function GetMod() {
    //Get mod variables
    //Temporary
    
    if (Settings.mod.HasField("map")) {
        map = Mathf.Clamp(Settings.mod.Get("map"), 0, ServerSettings.maps.length - 1);
    }
    
    if (Settings.mod.HasField("gameMode")) {
        var gm:int = Settings.mod.Get("gameMode");
        if (gm in Settings.GetGameMode(map)) {
            gameMode = gm;
        }
    }
    
    if (Settings.mod.HasField("targetKills")) {
        targetKills = Mathf.Max(Settings.mod.Get("targetKills"), 5);
    }
    
    if (Settings.mod.HasField("startTime")) {
        startTime = Settings.mod.Get("startTime");
    }
    
    if (Settings.mod.HasField("respawnTime")) {
        respawnTime = Settings.mod.Get("respawnTime");
    }
    
    if (Settings.mod.HasField("deathTime")) {
        deathTime = Mathf.Max(Settings.mod.Get("deathTime"), respawnTime);
    }
    
    if (Settings.mod.HasField("startTime")) {
        startTime = Settings.mod.Get("startTime");
    }
    
    if (Settings.mod.HasField("startTime")) {
        startTime = Settings.mod.Get("startTime");
    }
    
    if (Settings.mod.HasMethod("OnGameEnd")) {
        Settings.mod.Invoke("OnGameEnd");
    }
    
    //reset
    team1Kills = 0;
    team2Kills = 0;
    team1Deaths = 0;
    team2Deaths = 0;
    winTeam = 0;
    statsSaved = false;
    gameStartTime = Time.time;
}

function SaveGameStats() {
    if (!statsSaved) {
        statsSaved = true;
        var data:String = map + "+" + gameMode + "+" + team1Kills + "+" + team2Kills + "+" + team1Deaths + "+" + team2Deaths + "+" + (Time.time - gameStartTime);
        var www = new WWW(Settings.backend + "/v1/outpost/game/save?data=" + data);
        
        return www;
    }
    return;
}

}