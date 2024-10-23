import React from 'react'

const HighlightWord = ({text, wordToHighlight, className, highlightClassName}:{text:string, wordToHighlight:string, className?:string, highlightClassName?:string}) => {

    const parts = text.split(new RegExp(`(${wordToHighlight})`, 'gi')); // Split by the word, keeping it in the array

    return (
      <div className={className}>
        {parts.map((part, index) =>
          part.toLowerCase() === wordToHighlight.toLowerCase() ? (
            <span key={index} className={highlightClassName}>{part}</span> // Apply custom color to the word
          ) : (
            part
          )
        )}
      </div>
    );
}

export default HighlightWord

