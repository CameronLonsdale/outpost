#pragma strict
class MapInfo extends MonoBehaviour {
    var Team1Spawns:Transform[];
    var Team2Spawns:Transform[];
    
	//Common Team Setup
	var SpawnCam:Camera;
	var RandomSpawns:Transform[];
    
    //post game setup
    var WinCam:Camera;
    var PostCam:Camera;
	
	//Capture System Setup
	var CaptureTheFlagPoint:CapturePoint;
	var CapturePointPoints:CapturePoint[];
	
	//General Map Settings
	var DeathPlane:Transform;
	var Ladders:Ladder[];
	var StaticNetworkObjects:StaticNetworkObject[];
	var VehicleSpawnPoints:VehicleSpawnPoint[];
	
	function UpdateReferences() {
		Ladders = FindObjectsOfType(typeof(Ladder)) as Ladder[];
		StaticNetworkObjects = FindObjectsOfType(typeof(StaticNetworkObject)) as StaticNetworkObject[];
		VehicleSpawnPoints = FindObjectsOfType(typeof(VehicleSpawnPoint)) as VehicleSpawnPoint[];
	}
}