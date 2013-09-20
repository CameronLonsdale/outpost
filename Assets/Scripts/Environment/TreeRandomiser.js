#pragma strict

var Size:float = 1;

var Lod0:GameObject[];
var Lod1:GameObject[];
var Lod2:GameObject[];

private var Treeobj:Transform;

function Randomise() {
	var RandList:GameObject[];
	if (transform.position.z < 10) {
		RandList = Lod0;
	}
	else if (transform.position.z < 30) {
		RandList = Lod1;
	}
	else {
		RandList = Lod2;
	}
	if (Treeobj) {
		DestroyImmediate(Treeobj.gameObject);
	}
	Treeobj = Instantiate(RandList[Random.Range(0, RandList.length)], transform.position, Quaternion(transform.rotation.x, Mathf.Deg2Rad * Random.Range(0, 360), transform.rotation.z, transform.rotation.w)).transform;
	Treeobj.parent = transform;
	Treeobj.localScale = Vector3(Size, Size, Size);
}

function Finish() {
	Randomise();
	Treeobj.parent = transform.parent;
	DestroyImmediate(gameObject);
}