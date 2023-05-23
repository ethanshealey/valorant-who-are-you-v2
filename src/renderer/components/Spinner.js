import React from 'react'

const Spinner = ({ text }) => {
  return (
    <div id="loading-wrapper">
        <h1>Waiting for Valorant...</h1>
        <div id="loading"></div>
    </div>
  )
}

export default Spinner