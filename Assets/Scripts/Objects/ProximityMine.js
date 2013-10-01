var Health:float = 30;
var Explosion:Transform;

var Proximity:float = 5;

private var DNO:DynamicNetworkObject;
private var CurrentPlayer:Player;
private var obj:NPlayer;

function Awake() {
	DNO = GetComponent("DynamicNetworkObject");
}

function Update() {
	if (Network.isServer && Health > 0 && !Settings.replayMode) {
		CurrentPlayer = DNO.netMan.CurrentPlayer;
		if (CurrentPlayer) {
			if (DNO.netMan.team != DNO.team && Vector3.Distance(CurrentPlayer.transform.position, transform.position) < Proximity) {
				DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
			}
		}
		
		for (obj in DNO.netMan.NPlayers.Values) {
			if (obj.object) {
				if (obj.Team != DNO.team && Vector3.Distance(obj.object.transform.position, transform.position) < Proximity) {
					DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, DNO.id);
				}
			}
		}
		
		if (DNO.id != DNO.netMan.netid) {
			if (!DNO.netMan.NPlayers[DNO.id].object) {
				DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
			}
		}
		else {
			if (!CurrentPlayer) {
				DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
			}
		}
	}
}

function Damage(amount:float, direction:Vector3, point:Vector3, pid:int) {
	if (Network.isServer && Health > 0 && !Settings.replayMode) {
		Health -= amount;
		if (Health <= 0) {
			DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, pid);
		}
	}
}

function OnDeath(pid:int) {
	Explosion = Instantiate(Explosion, transform.position, transform.rotation);
	Explosion.GetComponent("Explosion").SetId(pid, "Proximity Mine");
	Destroy(gameObject);
}