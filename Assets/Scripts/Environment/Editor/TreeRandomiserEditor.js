#pragma strict

@CustomEditor(TreeRandomiser)
class TreeRandomiserEditor extends Editor {
	var serObj:SerializedObject;
	var Size:SerializedProperty;
	var Lod0:SerializedProperty;
	var Lod1:SerializedProperty;
	var Lod2:SerializedProperty;
	var tr:TreeRandomiser;
	
	function OnEnable() {
		serObj = new SerializedObject(target);
		Size = serObj.FindProperty("Size");
		Lod0 = serObj.FindProperty("Lod0");
		Lod1 = serObj.FindProperty("Lod1");
		Lod2 = serObj.FindProperty("Lod2");
		tr = target as TreeRandomiser;
	}
	
	function OnInspectorGUI() {
		tr.Finish();
	}
}