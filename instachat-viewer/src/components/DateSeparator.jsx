import React from 'react';
import { format } from 'date-fns';

export default function DateSeparator({ date }) {
  const formattedDate = format(date, 'MMM d, yyyy');
  const dateKey = format(date, 'yyyy-MM-dd');

  return (
    <div className="date-separator-wrapper" data-date={dateKey}>
      <div className="line"></div>
      <div className="date-text">{formattedDate}</div>
      <div className="line"></div>
    </div>
  );
}
