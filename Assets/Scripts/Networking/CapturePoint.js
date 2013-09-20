#pragma strict

var team:int = 0;
var CP:float = 0;
var CaptureDistance:float;
var CaptureSpeed:float;
var DecapSpeed:float;

var ViewDistance:float;
var ViewDistanceFade:float;

function OnDrawGizmosSelected() {
	Gizmos.color = Color.red;
	Gizmos.DrawWireSphere(transform.position, CaptureDistance);
	Gizmos.color = Color.white;
	Gizmos.DrawWireSphere(transform.position, ViewDistance);
	Gizmos.DrawWireSphere(transform.position, ViewDistance + ViewDistanceFade);
}