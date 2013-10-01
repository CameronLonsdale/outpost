#pragma strict

var Top:Transform;
var Bottom:Transform;

function OnDrawGizmosSelected() {
	Gizmos.DrawWireCube(Top.position, Vector3(0.5, 2, 0.5));
	Gizmos.DrawWireCube(Bottom.position, Vector3(0.5, 2, 0.5));
}