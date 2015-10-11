var periodicallySendData = true; 
var useSendBeacon = false; 
var useExternalServerScript = true;
var externalServerScriptUrl = "http://147.175.149.104/logger/record_default.php";

function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16)+"000000000").substr(2,8);
        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
}

function X()
{
    var x = this;

    this.httpendpoint = window.location.href;
    
    // ak nepodporuje sendBeacon, tak sa bude odosielat v pravidelnych intervaloch ajaxom 
    if (periodicallySendData) {
        this.logTimeout = 5000;
        this.logInterval = setInterval(function () { x.flushLog(); }, this.logTimeout);
    } 
    
    this.logQueue = [];
    this.logSendCount = 0;
    this.logEventCount = 0;
    if (this.logTimeout > -1) {
        this.lastMouseX = 0;
        this.lastMouseY = 0;
    }

    // Session storage pre urcenie tabky
    if (sessionStorage.getItem('sid') == null)
        sessionStorage.setItem('sid', guid());
    this.sessionId = sessionStorage.sid;

    // Local storage pre urcenie prehliadaca
    if (localStorage.getItem('mid') == null)
        localStorage.setItem('mid', guid());
    this.machineId = localStorage.mid;
    
    // Muz alebo zena
    this.gender = 'na';
    
    // Vek
    this.age = 0;
    
    // Ako dlho je zaregistrovany (dni)
    this.membership = 0;

    this.outqueue = [];
    this.outserial = 0;

    this.procqueue = [];
    this.waitack = 0;

    // registrovanie udalosti
    $(document).on('ready mousemove mouseover mouseout mousedown mouseup click dblclick keydown keyup blur focus visibilitychange', function (ev) { x.eventReceived(ev); });
    $(window).on('load resize blur focus', function (ev) { x.eventReceived(ev); });
    
    $(document).on('touchstart touchend touchmove touchleave touchcancel', function (event) { x.eventTouchReceived(event); });

    $(window).bind('mousewheel DOMMouseScroll', function (ev) { x.eventMouseWheelReceived(ev); });
    $(window).bind('scroll', function (ev) { x.eventScrollReceived(ev); });

    $(window).bind('beforeunload', function() { return x.close(); }); 
    
}

X.prototype.eventMouseWheelReceived = function (event) {
    var ev = event.originalEvent;
    var delta = ev.detail ? ev.detail * (-120) : ev.wheelDelta; //Opera
    if (delta == 1 || delta == -1)
        delta = delta * 120;
    var eventName = (delta > 0) ? "wheelup" : "wheeldown";

    var elem = "";
    if (ev.target != null) {
        if (ev.target.localName == null)
            elem = ev.target;
        else
            elem = ev.target.localName;
    }

    this.sendLog(new Date().getTime(), eventName, delta, elem);
}

X.prototype.eventScrollReceived = function (ev) {
    var old = this.scrollYOld || 0;
    var eventName = (window.scrollY - old < 0) ? "scrollup" : "scrolldown";
    this.sendLog(new Date().getTime(), eventName, window.scrollX, window.scrollY);
    this.scrollYOld = window.scrollY;
}

X.prototype.eventMouseReceived = function (ev) {
    this.lastMouseX = ev.screenX;
    this.lastMouseY = ev.screenY;

    if (ev.target != null)
        this.sendLog(new Date().getTime(), ev.type, this.lastMouseX, this.lastMouseY, ev.target.localName);
    else
        this.sendLog(new Date().getTime(), ev.type, this.lastMouseX, this.lastMouseY);
}

X.prototype.eventTouchReceived = function (event) {
    event.preventDefault();
    var touches = event.originalEvent.touches;
    var ev = event.originalEvent;
    for (var i=0; i < touches.length; i++) {
      var touch = touches[i];
      this.lastTouchX = touch.screenX;
      this.lastTouchY = touch.screenY;       
      if (ev.target != null)
          this.sendLog(new Date().getTime(), ev.type, touches.length, touch.identifier, Math.round(touch.clientX * 100)/100, Math.round(touch.clientY * 100)/100, Math.round(touch.screenX * 100)/100, Math.round(touch.screenY * 100)/100, Math.round(touch.radiusX * 100)/100, Math.round(touch.radiusY * 100)/100, Math.round(touch.rotationAngle * 100)/100, Math.round(touch.force * 100)/100, ev.target.localName);
      else
          this.sendLog(new Date().getTime(), ev.type, touches.length, touch.identifier, Math.round(touch.clientX * 100)/100, Math.round(touch.clientY * 100)/100, Math.round(touch.screenX * 100)/100, Math.round(touch.screenY * 100)/100, Math.round(touch.radiusX * 100)/100, Math.round(touch.radiusY * 100)/100, Math.round(touch.rotationAngle * 100)/100, Math.round(touch.force * 100)/100);
    }
    if (touches.length == 0) {
        this.sendLog(new Date().getTime(), ev.type, touches.length);
    } 
}

X.prototype.eventReceived = function (ev) {
    if (this.logTimeout <= -1)
        return;

    if (this.logEventCount == 0) {
        var time = new Date();
        this.sendLog(new Date().getTime(), 'size', screen.width, screen.height, $(window).width(), $(window).height(), $(document).width(), $(document).height());
        this.sendLog(new Date().getTime(), 'colordepth', screen.colorDepth);
        this.sendLog(new Date().getTime(), 'timezone', time.getTimezoneOffset());
    }

    if (ev.type == 'click') {
        this.sendLog(new Date().getTime(), ev.type, ev.altKey, ev.button, ev.buttons || 0, ev.clientX, ev.clientY, ev.ctrlKey, ev.screenX, ev.screenY, ev.shiftKey, ev.target.localName, ev.target.id);
        return;
    }

    if (ev.type == 'blur' || ev.type == 'focus') {
        // odchod zo stranky / focus na stranku
        this.sendLog(new Date().getTime(), ev.type);
        return;
    }

    if (ev.type == 'visibilitychange') {
        // zmena viditelnosti
        var hidden = document.hidden;
        if (document.msHidden)
            hidden = document.msHidden;
        var visibilityState = document.visibilityState;
        if (document.msVisibilityState)
            visibilityState = document.msVisibilityState;

        this.sendLog(new Date().getTime(), ev.type, hidden, visibilityState);
        return;
    }

    if (ev.type == 'mousemove') {
        this.eventMouseReceived(ev);
        return;
    }
    if (ev.type == 'mouseover') {
        // ak sme na elemente, ktory ma id, zaznacime 
        this.eventMouseReceived(ev);
        return;
    }
    if (ev.type == 'mouseout') {
        // ak sme na elemente, ktory ma id, zaznacime 
        this.eventMouseReceived(ev);
        return;
    }

    if (ev.type == 'mousedown') {
        // ak sme na elemente, ktory ma id, zaznacime 
        this.eventMouseReceived(ev);
        return;
    }
    if (ev.type == 'mouseup') {
        // ak sme na elemente, ktory ma id, zaznacime 
        this.eventMouseReceived(ev);
        return;
    }
    if (ev.type == 'dblclick') {
        // ak sme na elemente, ktory ma id, zaznacime 
        this.eventMouseReceived(ev);
        return;
    }

    if (ev.type == 'resize') {
        // nacitana stranka
        this.sendLog(new Date().getTime(), ev.type, screen.width, screen.height, $(window).width(), $(window).height(), $(document).width(), $(document).height());
        return;
    }

    //console.log(ev.type);
    this.sendLog(new Date().getTime(), ev.type);

    if (ev.type == 'ready') {
        // nacitana stranka
        return;
    }

    if (ev.type == 'keydown') {
        // ak sme na elemente, ktory ma id, zaznacime 
        return;
    }

    if (ev.type == 'keyup') {
        // ak sme na elemente, ktory ma id, zaznacime 
        return;
    }

    if (ev.type == 'focusin') {
        // focus na element/stranku
        return;
    }
    if (ev.type == 'focusout') {
        // unfocus z elementu/stranky
        return;
    }
}





X.prototype.argsToMsgText = function (args) {
    var text = "";
    for (var i = 0; i < args.length; i++)
        text = text.concat(args[i],";");
    return text;
}


// ulozenie zaznamu na poslanie
X.prototype.sendLog = function () {
    this.logEventCount++;

    if (arguments.length == 0)
        return; // prazdna sprava

    if (this.logTimeout <= -1)
        return;

    this.logQueue.push(this.argsToMsgText(arguments));
}

// odoslanie neposlanych zaznamov
X.prototype.flushLog = function () {
    if (this.logQueue.length == 0)
        return;

    if (!useExternalServerScript)
        var serverScriptUrl =  this.httpendpoint + 'record.php';
    else
        var serverScriptUrl =  externalServerScriptUrl;
    var url = serverScriptUrl + '?mid=' + this.machineId + '&sid=' + this.sessionId + "&page=" + document.location.pathname + '&g=' + this.gender + '&age=' + this.age + '&mem=' + this.membership;
    this.logSendCount++;

    var data = "";

    while (this.logQueue.length > 0) {
        var msg = this.logQueue.shift();
        if (data.length > 0)
            data += "|";             
        data += msg;
    }

    this.send(url, data);  
};

X.prototype.close = function () {
    this.flushLog();
};

X.prototype.send = function (url, data) {
    if (this.sendBeaconSupported() && useSendBeacon)
        navigator.sendBeacon(url, data);
    else {
        $.ajax({
			     type: 'POST',
			     contentType: "text/plain",
			     url: url,
			     async: true,
           crossDomain: useExternalServerScript,
			     dataType : "text",
			     processData: false,
			     data: data			         
		    });
    }
}
     

X.prototype.sendBeaconSupported = function () {
    return (navigator.sendBeacon != null);
}

var logger = new X();