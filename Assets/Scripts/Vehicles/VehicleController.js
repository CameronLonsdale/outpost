#pragma strict
#pragma downcast

@script RequireComponent(typeof(Rigidbody))

class VehicleController extends MonoBehaviour {
	var sendCollisionMessage:boolean = false;
	var skinWidth:float = 0.09;
	var constraints:RigidbodyConstraints = RigidbodyConstraints.None;
	
	//Has the controller previously collided with something
	private var _isColliding:boolean = false;
	function get isColliding():boolean {
		return _isColliding;
	}

    //The stack limit for solving collisions
    var _stackLimit:int = 6;
	function get stackLimit():int {
		return _stackLimit;
	}
	function set stackLimit(value:int) {
		if (value <= 0) {
			throw new System.Exception("Value must be larger than 0");
		}
		_stackLimit = value;
	}

    //Reference Variables
    private var _rigidbody:Rigidbody;

	//Temporary
    private var distance:float;
    private var magnitude:float;
	private var stack:int;
	private var direction:Vector3;
	private var hit:RaycastHit;

    function Move(displacement:Vector3):boolean {
        //reset states
        _isColliding = false;

        //Keep displacement withing the constrained axis
        displacement = ConstrainVector(displacement);

        //Split displacement into it's components (direction, magnitude)
        direction = displacement.normalized;
        distance = displacement.magnitude;

        //The stack for collision solving
        stack = _stackLimit;

		while (distance > 0 && stack > 0) {
        	//Collision detected
        	magnitude = distance;
            if (rigidbody.SweepTest(direction, hit)) {
                if (hit.distance < distance + skinWidth) {
                	hit.distance = hit.distance - skinWidth;
                    
                    //Update states and send messages
                    _isColliding = true;

                    if (sendCollisionMessage) {
                        SendMessage("OnRigidbodyControllerHit", hit, SendMessageOptions.DontRequireReceiver);
                    }

                    //Get new Magnitude and Direction from collision info
                    //new direction is along the normal of the collision
                    direction = Vector3.Cross(Vector3.Cross(direction, -hit.normal), hit.normal);
                    direction = ConstrainVector(direction);
                    distance -= hit.distance;
                    magnitude = hit.distance;
                }
            }
            
            transform.position += direction*magnitude;
			stack -= 1;
        }
        
        return _isColliding;
    }

    function ConstrainVector(vector:Vector3):Vector3 {
        if ((constraints & RigidbodyConstraints.FreezePositionX) != RigidbodyConstraints.None) {
		    vector.x = 0;
	    }
	    if ((constraints & RigidbodyConstraints.FreezePositionY) != RigidbodyConstraints.None) {
		    vector.y = 0;
	    }
	    if ((constraints & RigidbodyConstraints.FreezePositionZ) != RigidbodyConstraints.None) {
		    vector.z = 0;
	    }
	    return vector;
    }
}