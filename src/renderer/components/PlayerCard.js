import React from 'react'
import cards from '../images/card.json'


const PlayerCard = (props) => {
  return (
    <div id="player-card" style={{ 'width': props.width }}>
      <div id="player-card-left">
        <img width='75px' height='75px' src={cards[props.user.image].Image} />
        <div id="name-and-level">
          <h1 id="name">
            {props.user.name}<span>{props.user.tag}</span>
          </h1>
          <h3 id="level">
            {props.user.level}
          </h3>
        </div>
      </div>
      <div id="player-card-right">
        <img id="rank" width='75px' height='75px' src={require(`../images/ranks/${props.user.rank}.png`)} />
        <div id="party"></div>
      </div>
    </div>
  )
}

export default PlayerCard