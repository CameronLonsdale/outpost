#pragma strict

var Icon:Texture2D;
var Name:String;
var ExplosionPrefab:Transform;
var InstantExplode:boolean = false;
var ExplosionTime:float = 3;
private var ExplosionTimer:float;
private var obj:Transform;
private var explosion:Explosion;

private var DNO:DynamicNetworkObject;

function Awake() {
	ExplosionTimer = Time.time + ExplosionTime;
	DNO = GetComponent(typeof(DynamicNetworkObject));
}

function Update () {
	if (Network.isServer && ExplosionTimer < Time.time) {
		DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
	}
}

function OnDeath(pid:int) {
	obj = Instantiate(ExplosionPrefab, transform.position, Quaternion.identity) as Transform;
	
	explosion = obj.GetComponent(typeof(Explosion)) as Explosion;
	if (explosion) {
		explosion.SetId(DNO.netMan, DNO.id, "Grenade");
	}
	
	Destroy(gameObject);
}

function OnCollisionStay() {
	if (Network.isServer && InstantExplode) {
		DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
	}
}

function OnCollisionEnter() {
	if (Network.isServer && InstantExplode) {
		DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
	}
}