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
	
	DNO = GetComponent("DynamicNetworkObject");
	Timer = Time.time + AdditionTime;
}

function Update() {
	if (!Settings.replayMode) {
		if (Timer < Time.time) {
			CurrentAmmo -= AmmoAdd;
			CurrentPlayer = DNO.netMan.CurrentPlayer;
			if (CurrentPlayer) {
				if (Vector3.Distance(transform.position, CurrentPlayer.transform.position) < Range) {
					if (CurrentPlayer.Equipped[CurrentPlayer.Selected].Ammo < CurrentPlayer.Equipped[CurrentPlayer.Selected].AmmoMax) {
						CurrentPlayer.Equipped[CurrentPlayer.Selected].Ammo += AmmoAdd;
						CurrentPlayer.Equipped[CurrentPlayer.Selected].Ammo = Mathf.Clamp(CurrentPlayer.Equipped[CurrentPlayer.Selected].Ammo, 0, CurrentPlayer.Equipped[CurrentPlayer.Selected].AmmoMax);
					}
				}
			}
			Timer = Time.time + AdditionTime;
		}
		if (CurrentAmmo <= 0 && Network.isServer) {
			DNO.netMan.networkView.RPC("DynamicObjectDeath", RPCMode.All, DNO.index, -1);
		}
	}
}

function OnDeath(pid:int) {
	Destroy(gameObject);
}