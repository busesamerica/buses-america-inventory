import React from 'react';

const InspectionBadge = ({ inspection, onClick, size = 'medium' }) => {
  if (!inspection) return null;

  const getBadgeStyle = (rating) => {
    const styles = {
      'Excellent': { background: '#10b981', color: 'white', icon: '⭐' },
      'Good': { background: '#3b82f6', color: 'white', icon: '✓' },
      'Fair': { background: '#f59e0b', color: 'white', icon: '⚠' },
      'Poor': { background: '#ef4444', color: 'white', icon: '⚠' },
      'Failed': { background: '#7f1d1d', color: 'white', icon: '✗' }
    };
    return styles[rating] || { background: '#6b7280', color: 'white', icon: '?' };
  };

  const sizeStyles = {
    small: {
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      borderRadius: '0.25rem'
    },
    medium: {
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      borderRadius: '0.375rem'
    },
    large: {
      padding: '0.75rem 1rem',
      fontSize: '1rem',
      borderRadius: '0.5rem'
    }
  };

  const badgeStyle = getBadgeStyle(inspection.overall_rating);
  const sizeStyle = sizeStyles[size];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontWeight: '600',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        ...badgeStyle,
        ...sizeStyle
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        }
      }}
      title={onClick ? 'Click to view inspection report' : undefined}
    >
      <span>{badgeStyle.icon}</span>
      <span>Inspection: {inspection.overall_rating}</span>
    </div>
  );
};

export default InspectionBadge;
