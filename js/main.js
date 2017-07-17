
var turnsInput = input.turns;

var shipsInput = input.init.ships;

var oceanInput = input.init.map;


function battleship() {
	
	// private
	var m_Constants = {
		CameraYOffset: 10,
		OceanYOffset: 0,
		ShipYOffset: 0,
        SinkDistance: 5,
        BulletArc: 2,
        WaitTimePerTileMoved: 300,
		WaitTimeBetweenAction: 100 // in miliseconds
	};

    var m_input = {};
	
    var m_ships = []; // stores formatted json of ship initialization
    var m_chain = []; // stores chainable actions in a turn
    var m_entity = {}; // object with id to html dom element of ships

    var m_test = 0;

    var m_ocean; 

	// public
	var app = {

        init: () => {
            m_input = {"ships": shipsInput, "turns": turnsInput, "ocean": oceanInput};
            app.preprocess(m_input);

            var doc = document.getElementById('scene');
            var track = document.createElement('a-curve');
            track.setAttribute('id', 'track');
            track.setAttribute('type', 'Line');
            doc.appendChild(track);

            app.render(m_ships);
            // call function to wait a bit before starting simulation
            app.simulate();
        },

        preprocess: (data) => {
            var translate = (d) => {
                var res = d;
                if (res.hasOwnProperty("atX") && res.hasOwnProperty("atY")) {
                    res['atX'] = 4*d.atX;
                    res['atZ'] = 4*d.atY; // make sure to move the y property before overriding it
                    res['atY'] = m_Constants.ShipYOffset;
                }
                res.x = 4*d.x;
                res.z = 4*d.y; // make sure to move the y property before overriding it
                res.y = m_Constants.ShipYOffset;
                return res;
            };
            var actions = [];
            var index = 0;

            // preprocess initial map information
            m_ocean = {"x": (4*Math.floor(data.ocean.x/2))-2, "y": m_Constants.OceanYOffset, "z": (4*Math.floor(data.ocean.y/2))-2, "width": (4*data.ocean.x), "depth": (4*data.ocean.y), "density": Math.min(3*data.ocean.x, 3*data.ocean.y)};

            // preprocess initial ship information
            data.ships.forEach((entry) => {
                m_ships.push(translate(entry));
            });

            // preprocess actions and turns information
            while(index < data.turns.length-1) {
                var chain = true;
                while(chain) {
                    if (index === data.turns.length)
                        break;

                    if (actions.length === 0) {
                        actions.push(translate(data.turns[index]));
                        index++;
                    }
                    // Ship id and action type has to be the same to be considered a chain-able action
                    else if (actions[0].id === data.turns[index].id && actions[0].type === data.turns[index].type) {
                        if (actions[0].type === "MOVE") {
                            actions.push(translate(data.turns[index]));
                            index++;
                        }
                        // Firing must be at the same coordinates to be considered a chain-able action
                        else if (actions[0].type === "FIRE" && actions[0].atX === 4*(data.turns[index].atX) && actions[0].atY === 4*(data.turns[index].atY)) {
                            actions.push(translate(data.turns[index]));
                            index++;
                        }
                        else if(actions[0].type === "SINK") {
                            actions.push(translate(data.turns[index]));
                            index++;
                        }
                        else {
                            chain = false;
                        }
                    }
                    else {
                        chain = false;
                    }
                }
                // add action chain to variable
                m_chain.push({"type": actions[0].type, "actions": actions});
                // reset chain actions
                actions = [];
            }
            console.log(m_chain);
        },

		// Displays the ocean, and ships
		// TODO: check the edge cases with the map edges/sizes
		render: (shipData) => {
			var doc = document.getElementById('scene'); // <a-scene> reference

			// re-position camera: camera must be already present when html loads
			var camera = document.getElementById('camera');
            camera.setAttribute('position', m_ocean.x + " " + m_ocean.y + " " + m_ocean.z);
			camera.setAttribute('camera', 'userHeight: ' + m_Constants.CameraYOffset);
			
			// Generate Map
			// TODO: Possible edge cases with the map edge not being big enough
			var map = document.createElement('a-ocean');

			map.setAttribute('position', m_ocean.x + " " + m_ocean.y + " " + m_ocean.z);
			map.setAttribute('width', String(m_ocean.width));
			map.setAttribute('depth', String(m_ocean.depth));
			map.setAttribute('density', String(m_ocean.density));
			doc.appendChild(map);

			// Spawn Ships
			shipData.forEach((entry) => {
				var ship = document.createElement('a-collada-model');
                var name = document.createElement('a-entity');
                name.setAttribute('position', "0 2 0");
                name.setAttribute('look-at', '#camera');
                name.setAttribute('text-geometry', "value: "+entry.name + "; font: #pacifico");
				ship.setAttribute('position', entry.x + " " + entry.y + " " + entry.z);
				ship.dataset.id = entry.id;
				ship.dataset.name = entry.name;
				ship.dataset.owner = entry.owner;
                ship.dataset.x = entry.x;
				ship.dataset.y = entry.y;
				ship.dataset.z = entry.z;
				ship.dataset.health = entry.hull;
				ship.dataset.hull = entry.hull;
				ship.dataset.firepower = entry.firepower;
				ship.dataset.speed = entry.speed;
				ship.dataset.range = entry.range;
				ship.setAttribute('src', '#ship');
				doc.appendChild(ship);
                ship.appendChild(name);
                m_entity[entry.id] = ship;

			});

		},

        sinkShip: (data) => {
            return new Promise((resolve, reject) => {
                var doc = document.getElementById('scene');
                var track = document.getElementById('track');
                var shipDom = m_entity[data[0].id];

                var debug = document.createElement('a-draw-curve');
                debug.setAttribute('curveref', '#track');
                debug.setAttribute('material', 'shader: line; color: black;');
                doc.appendChild(debug);

                var point1 = document.createElement('a-curve-point');
                var point2 = document.createElement('a-curve-point');
                point1.setAttribute('position', data[0].x + " " + data[0].y + " " + data[0].z);
                point2.setAttribute('position', data[0].x + " " + (data[0].y-m_Constants.SinkDistance) + " " + data[0].z);
                track.appendChild(point1);
                track.appendChild(point2);

                shipDom.setAttribute('alongpath', 'curve: #track; rotate: true; constraint: 0 1 0; delay: '+m_Constants.WaitTimeBetweenAction+'; dur: 3000;');

                var done = (event) => {
                    shipDom.removeAttribute('alongpath');
                    if (debug.parentNode) {
                        doc.removeChild(debug);
                    }

                    while(track.hasChildNodes()) {
                        track.removeChild(track.childNodes[0]);
                    }

                    //shipDom.removeEventListener('movingended', done);

                    if (shipDom.parentNode) {
                        doc.removeChild(shipDom);
                    }

                    resolve(event);
                };

                shipDom.addEventListener('movingended', done);
                // resolve();
            });
        },

        // Data passed in are one ships action of firing at one and only one coordinate
        fireShip: (data) => {
            return new Promise((resolve, reject) => {
                var doc = document.getElementById('scene');
                var track = document.getElementById('track');

                var bullet = document.createElement('a-sphere');
                var source = document.createElement('a-curve-point');
                var arc = document.createElement('a-curve-point');
                var target = document.createElement('a-curve-point');
                bullet.setAttribute('color', 'gray');
                bullet.setAttribute('radius', '0.1');
                bullet.setAttribute('position', data[0].x + " " + data[0].y + " " + data[0].z);
                source.setAttribute('position', data[0].x + " " + data[0].y + " " + data[0].z);
                target.setAttribute('position', data[0].atX + " " + data[0].atY + " " + data[0].atZ);
                arc.setAttribute('position', (data[0].atX+data[0].x)/2 + " " + (((data[0].atY+data[0].y)/2)+m_Constants.BulletArc) + " " + (data[0].atZ+data[0].z)/2);
                track.appendChild(source);
                track.appendChild(arc);
                track.appendChild(target);

                var debug = document.createElement('a-draw-curve');
                debug.setAttribute('curveref', '#track');
                debug.setAttribute('material', 'shader: line; color: red;');
                doc.appendChild(debug);

                var tmp = doc.appendChild(bullet);
                tmp.setAttribute('alongpath', 'curve: #track; rotate: true; constant: 0 0 1; delay: 200; dur: 500');

                var done = (event) => {
                    tmp.removeAttribute('alongpath');
                    if (debug.parentNode) {
                        doc.removeChild(debug);
                    }
                    while(track.hasChildNodes()) {
                        track.removeChild(track.childNodes[0]);
                    }

                    //tmp.removeEventListener('movingended', done);
                    if (tmp.parentNode) {
                        doc.removeChild(tmp);
                    }

                    resolve(event);
                }

                tmp.addEventListener('movingended', done);
                //resolve();
            });
        },

		// Data passed in must be for movement of one ship
		moveShip: (data) => {
            return new Promise((resolve, reject) => {

                var shipDom = m_entity[data[0].id]; // html element
                // if statement is not working
                // if (data.length === 1 && data[0].x === shipDom.dataset.x && data[0].z === shipDom.dataset.z) {
                //     // if shipDom tries to move against edge or occupied place
                //     alert("Skipped");
                //     resolve("Skipped");
                // }

                var doc = document.getElementById('scene'); // <a-scene> reference
                var track = document.getElementById('track');
                //var startCoord = {"x": data[0].x};

                var debug = document.createElement('a-draw-curve');
                debug.setAttribute('curveref', '#track');
                debug.setAttribute('material', 'shader: line; color: blue;');
                doc.appendChild(debug);

                // add current location as a starting point of the curve
                var point = document.createElement('a-curve-point');
                point.setAttribute('position', String(shipDom.dataset.x + " " + shipDom.dataset.y + " " + shipDom.dataset.z));
                track.appendChild(point);
                // add chain-able goal locations to the curve
                var previous = {'x': shipDom.dataset.x, 'z': shipDom.dataset.z};
                var xDistance = 0;
                var zDistance = 0;
                console.log("Moving: ", data);
                for (var i = 0; i < data.length; i++) {
                    point = document.createElement('a-curve-point');
                    point.setAttribute('position', data[i].x + " " + data[i].y + " " + data[i].z);
                    xDistance += Math.abs(data[i].x - previous.x);
                    zDistance += Math.abs(data[i].z - previous.z);
                    if (i + 1 < data.length && data[i].x === data[i+1].x && data[i].z === data[i+1].z) {
                        i++;
                    }
                    track.appendChild(point);
                    previous = {'x': data[i].x, 'z': data[i].z};
                }
                var dur = (xDistance+zDistance)*m_Constants.WaitTimePerTileMoved;
                shipDom.setAttribute('alongpath', 'curve: #track; rotate: true; constraint: 0 0 1; delay: '+m_Constants.WaitTimeBetweenAction+'; dur: '+dur+';');

                var done = (event) => {
                    // var list = document.getElementByTagName('a-draw-curve');
                    // for (var i = 0; i < list.length; i++) {
                    //     list[0].parentNode.removeChild(list[0]);
                    // }
                    if (debug.parentNode) {
                        doc.removeChild(debug);
                    }

                    while(track.hasChildNodes()) {
                        track.removeChild(track.childNodes[0]);
                    }
                    
                    shipDom.removeAttribute('alongpath');
                    shipDom.dataset.x = data[data.length-1].x;
                    shipDom.dataset.z = data[data.length-1].z;
                    shipDom.dataset.y = data[data.length-1].y;

                    //shipDom.removeEventListener('movingended', done);
                    resolve(event);
                };

                shipDom.addEventListener('movingended', done);

                
            });
		},

		simulate: () => {
            console.log("chain: ", m_chain);
            var current = m_chain.shift();
            if (current && m_chain.length != 0) {
                console.log("current: ", current);
                switch(current.type) {
                    case "MOVE":
                        app.moveShip(current.actions).then((done) => {
                            //alert("Moved " + m_chain.length + " actions left");
                            app.simulate();
                        }).catch((err) => {
                            console.error(err);
                        });
                        break;
                    case "FIRE":
                        app.fireShip(current.actions).then((done) => {
                            //alert("Fired " + m_chain.length + " actions left");
                            app.simulate();
                        }).catch((err) => {
                            console.error(err);
                        });
                        break;
                    case "SINK":
                        app.sinkShip(current.actions).then((done) => {
                            //alert("Sunk "+ m_chain.length + " actions left");
                            app.simulate();
                        }).catch((err) => {
                            console.error(err);
                        });
                        break;
                    default:
                        console.log("Unknown Action Type " + current.type + " in simulate function");
                }
            } else {
                alert("Simulation Done");
            }

		},

		/** translates the coordinate in the java game to this scene's coordinate
			Java Game: Each ship spans one (x, y) unit
			Java Game: Coordinate system has (0, 0) at top left corner (without negatives)
			AFrame Scene: Each ship model is a 4x4 box
			AFrame Scene: Coordinate system is (0, 0) at the center (with negatives)
		*/
		getStrCoord: (coord, offsetY) => {
			return (m_ocean.x-coord.x)*4 + " " + offsetY + " " + (m_ocean.y-coord.y)*4;
		},

		getShips: () => {
			return m_ships;
		},

        getOcean: () => {
            return m_ocean;
        }


	}

	return app;
}

var app = battleship();
var BATTLE_SERVER_URL = 'https://battleship-vingkan.c9users.io/evilfleet/63';// + Math.ceil(Math.random() * 100);

$.get(BATTLE_SERVER_URL).then(data => {
    input = data;
    app.init();
}).done(() => {
    console.log("Data successfully retrieved from server");
}).fail(() => {
    console.log("Unable to retrieve data, starting with local data");
    app.init();
});






