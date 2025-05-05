import React, { useCallback, useEffect, useState, useRef } from 'react';
import styled from 'styled-components';

interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  min,
  max,
  value,
  onChange,
}) => {
  const [minVal, setMinVal] = useState(value[0]);
  const [maxVal, setMaxVal] = useState(value[1]);
  
  const minValRef = useRef(value[0]);
  const maxValRef = useRef(value[1]);
  const rangeRef = useRef<HTMLDivElement>(null);
  
  // Convert to percentage
  const getPercent = useCallback(
    (value: number) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );
  
  // Set width of the range to decrease from the left side
  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);
    
    if (rangeRef.current) {
      rangeRef.current.style.left = `${minPercent}%`;
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);
  
  // Set width of the range to decrease from the right side
  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);
    
    if (rangeRef.current) {
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);
  
  // Get min and max values when their state changes
  useEffect(() => {
    onChange([minVal, maxVal]);
  }, [minVal, maxVal, onChange]);
  
  return (
    <SliderContainer>
      <SliderTrack />
      <SliderRange ref={rangeRef} />
      <SliderLeftValue
        type="range"
        min={min}
        max={max}
        value={minVal}
        onChange={(event) => {
          const value = Math.min(Number(event.target.value), maxVal - 1);
          setMinVal(value);
          minValRef.current = value;
        }}
      />
      <SliderRightValue
        type="range"
        min={min}
        max={max}
        value={maxVal}
        onChange={(event) => {
          const value = Math.max(Number(event.target.value), minVal + 1);
          setMaxVal(value);
          maxValRef.current = value;
        }}
      />
    </SliderContainer>
  );
};

export default PriceRangeSlider;

// Styled Components
const SliderContainer = styled.div\`
  position: relative;
  width: 100%;
  height: 16px;
\`;

const SliderTrack = styled.div\`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background-color: var(--gray-light);
  border-radius: 8px;
  z-index: 1;
\`;

const SliderRange = styled.div\`
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: var(--primary-color);
  border-radius: 8px;
  z-index: 2;
\`;

const SliderInput = styled.input\`
  position: absolute;
  top: -5px;
  height: 16px;
  width: 100%;
  -webkit-appearance: none;
  pointer-events: none;
  opacity: 0;
  z-index: 3;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    background-color: var(--primary-color);
    pointer-events: auto;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background-color: var(--primary-color);
    pointer-events: auto;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
\`;

const SliderLeftValue = styled(SliderInput)\`
  // Specific styles for left thumb if needed
\`;

const SliderRightValue = styled(SliderInput)\`
  // Specific styles for right thumb if needed
\`;