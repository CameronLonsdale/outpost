#pragma strict

var VehicleType:int;
var TimeDelay:float;

@System.NonSerialized
var networkManager:NetworkManager;
private var vehicle:Vehicle;

function Start() {
	if (Network.isServer) {
		Spawn();
	}
}

function Update() {
	if (Network.isServer) {
		if (!vehicle) {
			Spawn();
		}
	}
}

function Spawn() {
	vehicle = networkManager.SpawnVehicle(VehicleType, Vector3(transform.position.x, transform.position.y, 0));
}