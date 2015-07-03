describe('gmMap', function () {

  var provider, gmLibrary,
    $window, $document, $q, $compile, $rootScope, $scope, $timeout,
    element, scope, controller, googleMaps;


  //---------------------------------------------------------------------------
  // Load Provider
  //---------------------------------------------------------------------------
  beforeEach(function () {
    var fakeModule = angular.module('test.app.config', function () {});

    fakeModule.config(function (gmLibraryProvider) {
      provider = gmLibraryProvider;
    });

    module('GoogleMapsNative', 'test.app.config');

    inject(function () {});
  });

  //---------------------------------------------------------------------------
  // Inject required
  //---------------------------------------------------------------------------
  beforeEach(inject(function(_$window_, _$document_, _$q_, _$rootScope_, _$timeout_, _$compile_) {
    $window = _$window_;
    $document = _$document_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    $compile = _$compile_;
    $scope = $rootScope.$new();
  }));


  //---------------------------------------------------------------------------
  // Simulate Google library load
  //---------------------------------------------------------------------------
  beforeEach(function(){

    provider.configure({
      url: 'http://url',
      callback: '__callback'
    });

    gmLibrary = provider.$get[4]($document, $window, $rootScope, $q);

    gmLibrary.load().then(function () {
      gmLibrary.populate($rootScope);
    });

    // simulate load ends
    $window.__callback();

    // required for promise to be resolved
    $rootScope.$digest();

    expect($rootScope.google).not.to.be.an('undefined');

    googleMaps = $rootScope.google.maps;
  });

  //---------------------------------------------------------------------------
  // TESTS
  //---------------------------------------------------------------------------

  /**
   * Compile template and populate "global" variable
   * @param template
   */
  function compile(template) {
    element = $compile(template)($scope);
    $scope.$digest();
    $timeout.flush();
    scope = element.scope();
    controller = element.controller('gmMap');
  }

  it('test simple case', function () {
    compile('<gm-map options="{center: [37, -122], zoom: 8}"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);
  });

  it('wait for center and zoom', function () {
    compile('<gm-map center="center" zoom="zoom"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(false);

    expect(scope.map).to.be.an('undefined');

    $scope.center = [37, -122];
    $scope.$digest();

    expect(scope.map).to.be.an('undefined');

    $scope.zoom = 4;
    $scope.$digest();
    $timeout.flush();

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);
    expect(scope.map.__data.center.lat()).to.be.equal($scope.center[0]);
    expect(scope.map.__data.center.lng()).to.be.equal($scope.center[1]);
  });


  it('test watch expressions', function () {
    compile('<gm-map center="center" mapTypeId="mapTypeId" heading="heading" tilt="tilt" zoom="zoom" options="{center: [37, -122], zoom: 8}"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);


    angular.forEach('center mapTypeId heading tilt zoom', function (name) {
      expect(scope.map.__get(name)).to.be.an('undefined');
    });

    $scope.center = [37, -122];
    $scope.$digest();

    expect(scope.map.getCenter() instanceof googleMaps.LatLng).to.be.equal(true);
    expect(scope.map.getCenter().lat()).to.be.equal($scope.center[0]);
    expect(scope.map.getCenter().lng()).to.be.equal($scope.center[1]);


    $scope.mapTypeId = "xxx";
    $scope.$digest();
    expect(scope.map.getMapTypeId()).to.be.equal($scope.mapTypeId);

    angular.forEach('heading tilt zoom'.split(" "), function (name) {
      $scope[name] = "123"; // voluntary set string to test cast to int
      $scope.$digest();
      expect(scope.map.__get(name)).to.be.a('number');
      expect(scope.map.__get(name)).to.be.equal(1 * $scope[name]);
    });

  });


  it('test events', function () {

    $scope.data = {
      clickedOnce: 0,
      clicked: 0,
      centerChanged: 0
    };

    compile('<gm-map  ' +
      // classic
      'on-click="data.clicked = data.clicked + 1" ' +
      // test "once"
      'once-click="data.clickedOnce = data.clickedOnce + 1" ' +
      // test with name not normalized
      'on-center_changed = "data.centerChanged = data.centerChanged + 1" ' +
      'options="{center: [37, -122], zoom: 8}"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);

    googleMaps.event.trigger(scope.map, 'click');
    googleMaps.event.trigger(scope.map, 'click');
    googleMaps.event.trigger(scope.map, 'center_changed');
    googleMaps.event.trigger(scope.map, 'center_changed');
    $scope.$digest();
    $timeout.flush();

    expect(scope.data.clickedOnce).to.be.equal(1);
    expect(scope.data.clicked).to.be.equal(2);
    expect(scope.data.centerChanged).to.be.equal(2);

  });

  it('test ng-show', function () {
    var map, catched;

    $scope.data = {
      resize: 0
    };

    compile('<gm-map ng-show="visible" on-resize="data.resize = data.resize + 1" options="{center: [37, -122], zoom: 8}"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(false); // because not yet visible
    expect(scope.data.resize).to.be.equal(0);

    $scope.visible = true;
    $scope.$digest();
    $timeout.flush();

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);
    expect(scope.data.resize).to.be.equal(0); // not yet triggered, because is just created

    map = scope.map; // keep a handler on current object, because it should not be destroyed now

    $scope.visible = false;
    $scope.$digest();
    catched = false;
    try {
      $timeout.flush();
    }
    catch(err) {
      catched = true; // no event to trigger
    }
    expect(catched).to.be.equal(true);

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true); // should not be destroyed
    expect(scope.map === map).to.be.equal(true); // should be the same object
    expect(scope.data.resize).to.be.equal(0); // not yet triggered, because not yet visible

    $scope.visible = true;
    $scope.$digest();
    $timeout.flush();

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true); // should not be destroyed
    expect(scope.map === map).to.be.equal(true); // should be the same object
    expect(scope.data.resize).to.be.equal(1); // should be triggered now

  });

  it('test ng-hide', function () {
    var map, catched;

    $scope.hidden = true;

    $scope.data = {
      resize: 0
    };

    compile('<gm-map ng-hide="hidden" on-resize="data.resize = data.resize + 1" options="{center: [37, -122], zoom: 8}"></gm-map>');
    expect(scope.map instanceof googleMaps.Map).to.be.equal(false); // because not yet visible
    expect(scope.data.resize).to.be.equal(0);

    $scope.hidden = false;
    $scope.$digest();
    $timeout.flush();

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true);
    expect(scope.data.resize).to.be.equal(0); // not yet triggered, because is just created

    map = scope.map; // keep a handler on current object, because it should not be destroyed now

    $scope.hidden = true;
    $scope.$digest();
    catched = false;
    try {
      $timeout.flush();
    }
    catch(err) {
      catched = true; // no event to trigger
    }
    expect(catched).to.be.equal(true);

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true); // should not be destroyed
    expect(scope.map === map).to.be.equal(true); // should be the same object
    expect(scope.data.resize).to.be.equal(0); // not yet triggered, because not yet visible

    $scope.hidden = false;
    $scope.$digest();
    $timeout.flush();

    expect(scope.map instanceof googleMaps.Map).to.be.equal(true); // should not be destroyed
    expect(scope.map === map).to.be.equal(true); // should be the same object
    expect(scope.data.resize).to.be.equal(1); // should be triggered now

  });

});