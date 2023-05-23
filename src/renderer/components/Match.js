import React from 'react'
import MatchPlayerCard from './MatchPlayerCard'
import Mode from './Mode'
import Map from './Map'

const Match = (props) => {

  return (
    <div id="match-wrapper">
      <div id="match-header">
        <Mode mode={props.match.mode} />
        <Map map={props.match.map} />
      </div>
      <div id="team-comp">
        <div id="blue">
          {
            props.match.blue.map((player) => (
              <MatchPlayerCard player={player} />
            ))
          }
        </div>
        <div id="red">
          {
            props.match.red.map((player) => (
              <MatchPlayerCard player={player} />
            ))
          }
        </div>
      </div>
    </div>
  )
}

export default Match