import React from 'react'
import maps from '../images/map.json'

const Map = (props) => {

    return (
        <div id="map">
            <img src={ require(`../images/maps/${maps[props.map].UUID}.png`)} height="60px" />
            <h3 id="map-name">{ maps[props.map].Name }</h3>
        </div>
    )
}

export default Map