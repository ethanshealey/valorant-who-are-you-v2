import React from 'react'
import agents from '../images/agent.json'

const MatchPlayerCard = (props) => {
  return (
    <div id="match-player-card" style={{ 'width': props.width }}>
      <div id="match-player-card-left">
        <img width='75px' height='75px' src={require(`../images/agents/${props.player.character.toLowerCase()}.png`)} />
        <div id="match-player-name-and-level">
          <h3>{ agents[props.player.character] }</h3>
          <h1 id="match-player-name">
            {props.player.name}<span>{props.player.tag}</span>
          </h1>
          <h3 id="match-player-level">
            {props.player.level}
          </h3>
        </div>
      </div>
      <div id="match-player-card-right">
        <img id="rank" width='60px' height='60px' src={require(`../images/ranks/${props.player.rank.CompetitiveTier}.png`)} />
      </div>
    </div>
  )
}

export default MatchPlayerCard