#pragma strict

var time:float;
private var timer:float;

function Start () {
	timer = Time.time + time;
}

function Update () {
	if (timer < Time.time) {
		Destroy(gameObject);
	}
}