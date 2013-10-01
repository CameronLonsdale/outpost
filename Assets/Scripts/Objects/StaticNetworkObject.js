#pragma strict

@System.NonSerialized
var netMan:NetworkManager;
@System.NonSerialized
var index:int;

private var sD:StaticDestruction;

function Awake() {
	sD = GetComponent(typeof(StaticDestruction)) as StaticDestruction;
}

function Damage(amount:float, direction:Vector3, point:Vector3) {
	if (Network.isServer) {
		if (sD) {
			sD.Damage(amount, direction, point);
		}
	}
}

function Kill() {
	SendMessage("OnDeath");
}