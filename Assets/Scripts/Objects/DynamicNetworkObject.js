#pragma strict

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

//Attributes
var hasDamage:boolean = false;;
var health:float = 0.0;

//Temporary Variables
private var sno:StaticNetworkObject;
private var magnitude:float;

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
	if (hasDamage) {
        if (health > 0) {
            health -= amount;
            
            if (health < 0) {
                netMan.network.RPC("_DynamicObjectDeath", RPCMode.All, index, pid);
            }
        }
    }
}

function Kill(pid:int) {
	SendMessage("OnDeath", pid);
}

function Vanish() {
	Destroy(gameObject);
}

function OnCollisionEnter(collision:Collision) {
    sno = collision.collider.GetComponent(typeof(StaticNetworkObject)) as StaticNetworkObject;
    if (sno) {
        magnitude = rigidbody.velocity.magnitude;
        if (magnitude > 0.1) {
            sno.Damage(Mathf.Max(magnitude*5, 30), rigidbody.velocity, collision.contacts[0].point);
        }
    }
}