#pragma strict

import System.IO;
import System.Reflection;
import System.CodeDom.Compiler;
import System.Text;
import System;
import System.Linq;

class CodeCompiler extends EditorWindow {
	@MenuItem ("Window/Code Compiler")
    static function ShowWindow() {
        EditorWindow.GetWindow(CodeCompiler);
    }
    
    var source:TextAsset;
    
    function OnGUI() {
    	GUILayout.BeginHorizontal();
    	GUILayout.Label("Source File");
    	source = EditorGUILayout.ObjectField(source, TextAsset, false) as TextAsset;
    	GUILayout.EndHorizontal();
    	
    	if (GUILayout.Button("Compile")) {
    		var results:CompilerResults = CompileCode(source);
    		Debug.Log(results.Errors.HasErrors);
    		Debug.Log(results.PathToAssembly);
    		File.Move(results.PathToAssembly, Application.dataPath + "/" + source.name + ".dll");
    	}
    }
    
    static function CompileCode(source:TextAsset) {
    	var params:CompilerParameters = new CompilerParameters();
    	
    	params.GenerateExecutable = false;
    	params.OutputAssembly = source.name + ".dll";
    	
		var provider:CodeDomProvider = new CodeDomProvider.CreateProvider("CSharp");
		var results:CompilerResults = provider.CompileAssemblyFromSource(params, source.text);
		return results;
    }
}