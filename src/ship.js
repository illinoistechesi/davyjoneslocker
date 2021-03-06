
function Ship() {
	let action = {
		render: (data) => {
			let attr = {
				"dom": null, // ships html dom component
				"health": null, // ship's health bar, display as dots
				"color": null, // ship color
				"name": null, // ship's display name
				"owner": null,
				"id": null,
				"x": null,
				"y": null,
				"z": null,
				"firepower": null,
				"hull": null,
				"speed": null,
				"range": null,
				"sunk": null
			}
			for (let keys in data) {
				attr[keys] = data[keys];
			}

			let doc = document.getElementById('scene');
			let ship = document.createElement('a-entity');

			ship.setAttribute('position', data.x + ' ' + data.y + ' ' + data.z);
			if (data.color === 'rgb(255, 255, 0)') {
				ship.setAttribute('template', 'src: #submarine-template');
				ship.setAttribute('class', 'submarine');
			}
			else {
				ship.setAttribute('template', 'src: #boat-template');
				ship.setAttribute('class', 'boat');
			}

			let heart = '';
			for (let i = 0; i < data.hull; i++) {
				heart += ' •';
			}

			// ${variable} <- variable name be lower case
			ship.setAttribute('data-ship_color', `color: ${data.color}; metalness: 0.4;`);
			ship.setAttribute('data-ship_name', `value: ${data.name}; font: #play;`);
			ship.setAttribute('data-ship_health', `value: ${heart}';`);

			attr.dom = doc.appendChild(ship);

			return attr;
		},

		update: (domElement, current) => {
			return new Promise((resolve, reject) => {
				console.log(domElement);
				console.log(current);
				current.states.forEach((state) => {
					let ship = domElement[state.id];
					let heart = '';
					for (let i = 0; i < state.health; i++) {
						heart += ' •';
					}

					ship.dom.setAttribute('position', `${state.x} ${state.y} ${state.z}`);
					ship.dom.setAttribute('visible', !state.sunk);
					ship.dom.setAttribute('health', `value: ${heart}`);
					console.log(heart);
					ship.dom.removeAttribute('alongpath');
				});
				let doc = document.getElementById('scene');
				let track = document.getElementById('track');
				
				doc.removeChild(track);
				track = document.createElement('a-curve');
				track.setAttribute('id', 'track');
				track.setAttribute('type', 'Line');
				doc.appendChild(track);

				// while(track.hasChildNodes()) {
				// 	track.removeChild(track.childNodes[0]);
				// }
				resolve();
			});
		},

		sinkShip: (domElement, current, OPTION) => {
			return new Promise((resolve, reject) => {
				let doc = document.getElementById('scene');
				let track = document.getElementById('track');
				console.log("sinkShip(): ", domElement, current);
				let action = current.task.actions[0]; // sink action should only have a size of one
				let ship = domElement[action.id];
				
				let debug = document.createElement('a-draw-curve');
				debug.setAttribute('curveref', '#track');
				debug.setAttribute('material', 'shader: line; color: black;');
				doc.appendChild(debug);

				var point1 = document.createElement('a-curve-point');
				var point2 = document.createElement('a-curve-point');
				point1.setAttribute('position', `${action.x} ${action.y} ${action.z}`);
				point2.setAttribute('position', `${action.x} ${(action.y - OPTION.SinkDistance)} ${action.z}`);
				track.appendChild(point1);
				track.appendChild(point2);

				ship.dom.setAttribute('alongpath', `curve: #track; rotate: true; constraint: 0 1 0; delay: ${OPTION.WaitTimeBetweenAction}; dur: 3000;`);

				ship.dom.addEventListener('movingended', () => {
					ship.dom.removeAttribute('alongpath');
					ship.dom.setAttribute('visible', false);

					if (debug.parentNode) {
						doc.removeChild(debug);
					}

					while(track.hasChildNodes()) {
						track.removeChild(track.childNodes[0]);
					}

					resolve();
				});
			});
		},

		hitShip: (domElement, current) => {
			return new Promise((resolve, reject) => {
				let action = current.task.actions[0];
				let ship = domElement[action.id];
				let heart = '';

				for (let i = 0; i < action.health; i++) {
					heart += ' •';
				}
				console.log(ship.dom.childNodes.length);
				for (let i = 0; i < ship.dom.childNodes.length; i++) {
					if (ship.dom.childNodes[i].className === 'ship-health') {
						ship.dom.childNodes[i].setAttribute('text-geometry', `value: ${heart};`);
						break;
					}
				}

				resolve();
			});
		},

		fireShip: (current, OPTION) => {
			return new Promise((resolve, reject) => {
				let doc = document.getElementById('scene');
				let track = document.getElementById('track');
				let data = current.task.actions;

				let bullet = document.createElement('a-sphere');
				let source = document.createElement('a-curve-point');
				let arc = document.createElement('a-curve-point');
				let target = document.createElement('a-curve-point');
				bullet.setAttribute('color', 'gray');
				bullet.setAttribute('radius', '0.1');
				bullet.setAttribute('position', `${data[0].x} ${data[0].y} ${data[0].z}`);
				source.setAttribute('position', `${data[0].x} ${data[0].y} ${data[0].z}`);
				target.setAttribute('position', `${data[0].atX} ${data[0].atY} ${data[0].atZ}`);
				arc.setAttribute('position', `${(data[0].atX+data[0].x)/2} ${(((data[0].atY+data[0].y)/2)+OPTION.BulletArc)} ${(data[0].atZ+data[0].z)/2}`);
				track.appendChild(source);
				track.appendChild(arc);
				track.appendChild(target);

				let debug = document.createElement('a-draw-curve');
				debug.setAttribute('curveref', '#track');
				debug.setAttribute('material', 'shader: line; color: red;');
				doc.appendChild(debug);

				let path = doc.appendChild(bullet);
				path.setAttribute('alongpath', 'curve: #track; rotate: true; constant: 0 0 1; delay: 200; dur: 500');

				path.addEventListener('movingended', () => {
					path.removeAttribute('alongpath');
					if (debug.parentNode) {
						doc.removeChild(debug);
					}

					while(track.hasChildNodes()) {
						track.removeChild(track.childNodes[0]);
					}

					if (path.parentNode) {
						doc.removeChild(path);
					}

					resolve();
				});
			});
		},

		moveShip: (domElement, current, OPTION) => {
			return new Promise((resolve, reject) => {
				let doc = document.getElementById('scene');
				let track = document.getElementById('track');
				let data = current.task.actions;
				let ship = domElement[data[0].id];

				// add a path to show movement along the path
				let debug = document.createElement('a-draw-curve');
				debug.setAttribute('curveref', '#track');
				debug.setAttribute('material', 'shader: line; color: blue;');
				doc.appendChild(debug);

				// add current location as a starting point of the curve
				let point = document.createElement('a-curve-point');
				point.setAttribute('position', ship.x + ' ' + ship.y + ' ' + ship.z);
				track.appendChild(point);
				// add chain-able goal locations to the curve
				let previous = {x: ship.x, z: ship.z};
				let xDistance = 0;
				let zDistance = 0;

				for (let i = 0; i < data.length; i++) {
					point = document.createElement('a-curve-point');
					point.setAttribute('position', `${data[i].x} ${data[i].y} ${data[i].z}`);
					xDistance += Math.abs(data[i].x - previous.x);
					zDistance += Math.abs(data[i].z - previous.z);
					track.appendChild(point);
					previous = {x: data[i].x, z: data[i].z};
					if (i + 1 < data.length && data[i].x === data[i+1].x && data[i].z === data[i+1].z) {
						i++;
					}
				}

				// define time for movement so that speed of difference distance is consistent
				let duration = (xDistance+zDistance)*OPTION.WaitTimePerTileMoved;
				ship.dom.setAttribute('alongpath', `curve: #track; rotate: true; constraint: 0 0 1; delay: ${OPTION.WaitTimeBetweenAction}; dur: ${duration};`);

				ship.dom.addEventListener('movingended', function() {
					if (debug.parentNode) {
						doc.removeChild(debug);
					}

					while(track.hasChildNodes()) {
						track.removeChild(track.childNodes[0]);
					}

					ship.dom.removeAttribute('alongpath');
					ship.x = data[data.length-1].x;
					ship.y = data[data.length-1].y;
					ship.z = data[data.length-1].z;

					resolve();
				});
			});
		}
	}

	return action;
}