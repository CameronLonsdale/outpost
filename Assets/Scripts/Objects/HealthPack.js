#pragma strict

var MaxHealth:int;
var HealthAdd:int;
@System.NonSerialized
var CurrentHealth:int;
var Range:float = 5;
var AdditionTime:float;

private var DNO:DynamicNetworkObject;
private var CurrentPlayer:Player;
private var Timer:float;

function Awake() {
	CurrentHealth = MaxHealth;
	transform.eulerAngles = Vector3(-90, 90, 0);
	
	DNO = GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;
	Timer = Time.time + AdditionTime;
}

function Update() {
    if (Network.isServer) {
        if (Timer < Time.time) {
            CurrentHealth -= HealthAdd;
            
            for (obj in DNO.netMan.NPlayers.Values) {
                if (obj.object) {
                    if (Vector3.Distance(obj.object.transform.position, transform.position) < Range) {
                        obj.object.Heal(DNO.id, HealthAdd);
                    }
                }
            }
            
            Timer = Time.time + AdditionTime;
        }
        
        if (CurrentHealth <= 0) {
            DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
        }
    }
}

function OnDeath(pid:int) {
	Destroy(gameObject);
}