package com.RomaJi;

import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class PythonModule extends ReactContextBaseJavaModule {
    private Python py;
    private PyObject myScript;

    public PythonModule(ReactApplicationContext reactContext) {
        super(reactContext);
        py = Python.getInstance();
        myScript = py.getModule("my_script");
    }

    @Override
    public String getName() {
        return "Python";
    }

    @ReactMethod
    public void call(String functionName, String input, Promise promise) {
        try {
            String result = myScript.callAttr(functionName, input).toString();
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("PYTHON_ERROR", e.getMessage());
        }
    }
}