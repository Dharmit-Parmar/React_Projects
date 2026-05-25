import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  addMonths,
  subMonths,
  parseISO
} from 'date-fns';

export default function JumpToDate({ availableDates, onDateSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const dropdownRef = useRef(null);

  const dateMap = new Set(availableDates);
  const sortedDates = [...availableDates].sort();
  
  const minDate = sortedDates.length > 0 ? parseISO(sortedDates[0]) : new Date();
  const maxDate = sortedDates.length > 0 ? parseISO(sortedDates[sortedDates.length - 1]) : new Date();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && sortedDates.length > 0) {
      setCurrentMonth(startOfMonth(parseISO(sortedDates[sortedDates.length - 1])));
    }
  }, [isOpen, sortedDates.length]);

  const isPrevDisabled = currentMonth.getFullYear() === minDate.getFullYear() && currentMonth.getMonth() === minDate.getMonth();
  const isNextDisabled = currentMonth.getFullYear() === maxDate.getFullYear() && currentMonth.getMonth() === maxDate.getMonth();

  const handlePrev = () => { if (!isPrevDisabled) setCurrentMonth(subMonths(currentMonth, 1)); };
  const handleNext = () => { if (!isNextDisabled) setCurrentMonth(addMonths(currentMonth, 1)); };

  const renderHeader = () => {
    const years = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
      years.push(y);
    }

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const handleMonthChange = (e) => {
      const newMonth = parseInt(e.target.value, 10);
      const newDate = new Date(currentMonth.getFullYear(), newMonth, 1);
      if (newDate < startOfMonth(minDate)) setCurrentMonth(startOfMonth(minDate));
      else if (newDate > startOfMonth(maxDate)) setCurrentMonth(startOfMonth(maxDate));
      else setCurrentMonth(newDate);
    };

    const handleYearChange = (e) => {
      const newYear = parseInt(e.target.value, 10);
      const newDate = new Date(newYear, currentMonth.getMonth(), 1);
      if (newDate < startOfMonth(minDate)) setCurrentMonth(startOfMonth(minDate));
      else if (newDate > startOfMonth(maxDate)) setCurrentMonth(startOfMonth(maxDate));
      else setCurrentMonth(newDate);
    };

    return (
      <div className="calendar-header">
        <button 
          className="icon-button small" 
          onClick={handlePrev}
          disabled={isPrevDisabled}
          style={{ opacity: isPrevDisabled ? 0.2 : 1, cursor: isPrevDisabled ? 'default' : 'pointer' }}
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="calendar-selectors">
          <select 
            value={currentMonth.getMonth()} 
            onChange={handleMonthChange}
            className="calendar-select"
          >
            {months.map((m, i) => {
              const isOut = (currentMonth.getFullYear() === minDate.getFullYear() && i < minDate.getMonth()) ||
                            (currentMonth.getFullYear() === maxDate.getFullYear() && i > maxDate.getMonth());
              return <option key={m} value={i} disabled={isOut}>{m}</option>;
            })}
          </select>
          <select 
            value={currentMonth.getFullYear()} 
            onChange={handleYearChange}
            className="calendar-select"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <button 
          className="icon-button small" 
          onClick={handleNext}
          disabled={isNextDisabled}
          style={{ opacity: isNextDisabled ? 0.2 : 1, cursor: isNextDisabled ? 'default' : 'pointer' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="calendar-day-header" key={i}>
          {format(addDays(startDate, i), 'EEEE').substring(0, 1)}
        </div>
      );
    }
    return <div className="calendar-grid">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const dateKey = format(day, 'yyyy-MM-dd');
        const hasChat = dateMap.has(dateKey);
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        days.push(
          <div
            className={`calendar-cell ${isCurrentMonth ? 'current-month' : ''} ${hasChat ? 'has-chat' : ''}`}
            key={day}
            onClick={() => {
              if (hasChat) {
                onDateSelect(dateKey);
                setIsOpen(false);
              }
            }}
          >
            {formattedDate}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="calendar-grid" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="calendar-body">{rows}</div>;
  };

  return (
    <div className="jump-to-date-container" ref={dropdownRef}>
      <button 
        className="icon-button" 
        onClick={() => setIsOpen(!isOpen)}
        title="Jump to Date"
      >
        <CalendarIcon size={20} />
      </button>
      
      {isOpen && (
        <div className="date-dropdown calendar-dropdown">
          <div className="calendar-container">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
          </div>
        </div>
      )}
    </div>
  );
}
