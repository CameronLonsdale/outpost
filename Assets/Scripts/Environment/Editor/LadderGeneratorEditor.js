#pragma strict

@CustomEditor(LadderGenerator)
class LadderGeneratorEditor extends Editor {
	var tr:LadderGenerator;
	
	function OnEnable() {
		tr = target as LadderGenerator;
	}
	
	function OnInspectorGUI() {
		DrawDefaultInspector();
		if (GUILayout.Button("Update Height")) {
			tr.SetLadder();
		}
	}
}