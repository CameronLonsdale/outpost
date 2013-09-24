@System.NonSerialized
var Pos:Vector3 = Vector3.zero;
@System.NonSerialized
var StartPos:Vector3 = Vector3.zero;
@System.NonSerialized
var Rot:Quaternion = Quaternion.identity;
@System.NonSerialized
var StartRot:Quaternion = Quaternion.identity;
@System.NonSerialized
var StartTime:float = 0;

@System.NonSerialized
var netMan:NetworkManager;
@System.NonSerialized
var index:int;
@System.NonSerialized
var id:int;
@System.NonSerialized
var team:int;
@System.NonSerialized
var type:int;

function Awake() {
	if (Network.isClient) {
		rigidbody.isKinematic = true;
		StartTime = Time.time;
		Pos = transform.position;
		StartPos = Pos;
		Rot = transform.rotation;
		StartRot = Rot;
	}
}

function Update() {
	if (Network.isClient) {
		transform.position = Vector3.Lerp(StartPos, Pos, (Time.time - StartTime)*15);
		transform.rotation = Quaternion.Lerp(StartRot, Rot, (Time.time - StartTime)*15);
	}
	if (Network.isServer && transform.position.y < netMan.mapInfo.DeathPlane.transform.position.y) {
		netMan.network.RPC("_DynamicObjectDeath", RPCMode.All, index, -2);
	}
}

function Damage(amount:float, direction:Vector3, point:Vector3, pid:int) {
	if (GetComponent("ProximityMine")) {
		GetComponent("ProximityMine").Damage(amount, direction, point, pid);
	}
}

function Kill(pid:int) {
	SendMessage("OnDeath", pid);
}

function Vanish() {
	Destroy(gameObject);
}