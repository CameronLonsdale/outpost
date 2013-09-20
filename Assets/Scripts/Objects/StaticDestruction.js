var Health:float = 30;
var Dependancy:Transform;
var DeathPrefab:Transform;

@System.NonSerialized
var direction:Vector3 = Vector3.zero;
@System.NonSerialized
var point:Vector3 = Vector3.zero;

private var SNO:StaticNetworkObject;

function Awake() {
	SNO = GetComponent("StaticNetworkObject");
}

function Damage(amount:float, dir:Vector3, pnt:Vector3) {
	direction = dir;
	point = pnt;
	if (Network.isServer && Health > 0) {
		if (!Dependancy) {
			Health -= amount;
			if (Health <= 0) {
				SNO.netMan.network.RPC("_StaticObjectDeath", RPCMode.All, SNO.index);
			}
		}
	}
}

function OnDeath() {
	if (DeathPrefab) {
		DeathPrefab = Instantiate(DeathPrefab, transform.position, transform.rotation);
		if (DeathPrefab.rigidbody) {
			DeathPrefab.rigidbody.AddForceAtPosition(direction, point);
		}
	}
	Destroy(gameObject);
}