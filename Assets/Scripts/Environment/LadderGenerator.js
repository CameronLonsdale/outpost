#pragma strict

var MiddleLadderHight:float = 1;
var LadderTop:Transform;
var LadderSide:Transform;
var LadderMiddle:Transform;
private var x:float = 0;
private var obj:Transform;

function SetLadder() {
	for (obj in transform.GetComponentsInChildren(Transform)) {
		if (obj != transform) {
			DestroyImmediate(obj.gameObject);
		}
	}
	
	obj = Instantiate(LadderTop, transform.position, transform.rotation);
	obj.parent = transform;
	obj = Instantiate(LadderSide, transform.position, transform.rotation);
	obj.parent = transform;
	obj.localScale.z = 1;
	
	x = 0;
	while (x + MiddleLadderHight < transform.localScale.z) {
		obj = Instantiate(LadderMiddle, transform.position - Vector3(0, x, 0), transform.rotation);
		obj.parent = transform;
		x += MiddleLadderHight;
	}
}