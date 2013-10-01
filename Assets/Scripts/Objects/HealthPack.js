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
    if (Timer < Time.time) {
        CurrentHealth -= HealthAdd;
        /*if (CurrentPlayer) {
            if (Vector3.Distance(transform.position, CurrentPlayer.transform.position) < Range) {
                if (DNO.netMan.health < 100) {
                    DNO.netMan.health += HealthAdd;
                    DNO.netMan.health = Mathf.Clamp(DNO.netMan.health, 0, 100);
                }
            }
        } -- need work*/
        Timer = Time.time + AdditionTime;
    }
    if (CurrentHealth <= 0 && Network.isServer) {
        DNO.netMan.networkView.RPC("_DynamicObjectDeath", RPCMode.All, DNO.index, -1);
    }
}

function OnDeath(pid:int) {
	Destroy(gameObject);
}