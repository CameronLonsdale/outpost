#pragma strict

var MaxAmmo:int;
var AmmoAdd:int;
@System.NonSerialized
var CurrentAmmo:int;
var Range:int;
var AdditionTime:float;

private var DNO:DynamicNetworkObject;
private var CurrentPlayer:Player;
private var Timer:float;

function Awake() {
	CurrentAmmo = MaxAmmo;
	transform.eulerAngles = Vector3(-90, 90, 0);
	
	DNO = GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;
	Timer = Time.time + AdditionTime;
}

function Update() {
    if (Network.isServer) {
        if (Timer < Time.time) {
            CurrentAmmo -= AmmoAdd;
            
            for (obj in DNO.netMan.NPlayers.Values) {
                if (obj.object) {
                    if (Vector3.Distance(obj.object.transform.position, transform.position) < Range) {
                        obj.object.Resupply(DNO.id, AmmoAdd);
                    }
                }
            }
            
            Timer = Time.time + AdditionTime;
        }
        
        if (CurrentAmmo <= 0) {
            DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
        }
    }
}

function OnDeath(pid:int) {
	Destroy(gameObject);
}