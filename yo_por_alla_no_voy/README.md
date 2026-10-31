# Yo por allá no voy

Eres un taxista a la salida del Rock al Parque. Dices "yo por allá no voy"
y toda la multitud te persigue. Esquívala, empújala con el pito y
aguanta hasta que se cansen.



### Cómo se juega

* Flechas o WASD: manejar (el taxi tiene inercia).
* ESPACIO: pitar. Empuja y aturde a la gente cercana (se recarga).
* P: pausa.
* Objetivo: aguantar el tiempo del nivel sin que te aborden.
* La barra sobre el taxi es el agarre: cada persona encima la llena.
  Si se llena, pierdes una vida.
* Embestir a alguien a buena velocidad lo aturde en vez de dejar que
  te agarre, pero si te frenas entre la multitud, te rodean.
* Las oleadas se avisan en rojo en el borde por donde entran.
* Los buses (desde el nivel 2) se avisan en rojo sobre el carril por
  el que van a pasar: llevan por delante a quien toquen.



### Física (matter.js)

* Cada persona, el taxi y los obstáculos son cuerpos de matter.js.
* La masa importa: los fans (livianos) salen volando, los metaleros
  (pesados) casi no se mueven con un pitazo.
* La gente se amontona contra las vallas, carpas y parlantes: úsalos.
* La simulación usa pasos fijos de 1/60 s (physics.js).



### Workspace Distribution

* yo\_por\_alla\_no\_voy.js: clase Game, estados, niveles
* physics.js: motor de física
* player.js: taxi
* crowd.js: gente (Rockero, Fan, Metalero) y oleadas
* obstacles.js: vallas, carpas, parlantes y buses
* background.js: escenario, HUD, pantallas y efectos
* manager.js: reglas de colisión, puntaje, tiempo y pantallas
* tools/generar\_imagenes.js: dibuja todas las imágenes por código
