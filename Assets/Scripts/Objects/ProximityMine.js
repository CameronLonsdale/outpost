#pragma strict

var explosion:Transform;

var Proximity:float = 5;

private var DNO:DynamicNetworkObject;
private var CurrentPlayer:Player;
private var obj:NPlayer;

function Awake() {
	DNO = GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;
	transform.eulerAngles.x = -90;
}

function Update() {
	if (Network.isServer) {
		for (obj in DNO.netMan.NPlayers.Values) {
			if (obj.object) {
				if (obj.team != DNO.team && Vector3.Distance(obj.object.transform.position, transform.position) < Proximity) {
					DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
				}
			}
		}
		
        if (!DNO.id in DNO.netMan.NPlayers || !DNO.netMan.NPlayers[DNO.id].object) {
            DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
        }
	}
}

function OnDeath(pid:int) {
	explosion = Instantiate(explosion, transform.position, transform.rotation);
	(explosion.GetComponent(typeof(Explosion)) as Explosion).SetId(DNO.netMan, pid, "Proximity Mine");
	Destroy(gameObject);
}