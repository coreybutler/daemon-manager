var manager = require('../'),
  assert = require('assert'),
  path = require('path');

suite('Sanity Tests', function(){

  var controller;

  setup(function(){
    controller = new manager.Controller({
      script: path.join(__dirname,'resources','app.js')
    });
  });
  
  teardown(function(){
    controller.removeAllListeners('ready');
    controller.killChildProcess();
  });
  
  test('Basic Initialization',function(){
    assert.ok(manager !== undefined,'The daemon manager was not loaded.');
    assert.ok(manager.Controller !== undefined,'The controller was not found.');
  });
  
  test('Startup & Shutdown',function(done){
    
    assert.ok(controller.hasOwnProperty('launch') == true,'The controller does not have the method launch().');
    
    controller.on('ready',function(){
      done();
    });
    
    controller.launch();
  });
  
  test('Auto-restart upon failure.',function(done){
    this.timeout(4000);
    
    var restartCount = 0;
    controller.on('starting',function(){
      restartCount++;
      restartCount > 1 && done();
    });
    controller.launch();
  });
  
  test('Abort On Error',function(done){
    this.timeout(6000);

    controller.abortOnError = true;
    
    assert.ok(controller.abortOnError == true,'The abort on error flag was not retained.');
    
    controller.on('aborted',function(){
      done();
    });
    
  });
  
});