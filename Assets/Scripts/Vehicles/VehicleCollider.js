#pragma strict

var vehicle:Vehicle;
var Multi:float = 1;

private var team:int;
function Update() {
	if (vehicle.team == 0) {
		gameObject.layer = 12;
	}
	else {
		gameObject.layer = 9 + vehicle.team;
	}
}