import React from 'react'

const Mode = (props) => {

    const toUpper = (str) => {
        return str.toLowerCase().split(' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')
    }

  return (
    <div id="mode">
        <img src={ require(`../images/modes/${toUpper(props.mode)}.png`)} height="50px" />
        <h3>{ toUpper(props.mode) }</h3>
    </div>
  )
}

export default Mode