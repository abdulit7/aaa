import styled from '@emotion/styled';
import { css } from '@emotion/react';

export const Card3D = styled.div<{ variant?: 'in' | 'out' | 'return' | 'purchase' | 'interbranch' | 'default'; hoverLift?: boolean }>`
  position: relative;
  background: #ffffff;
  border: 1px solid #dde1e6;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.16s ease;

  ${props => props.variant === 'in' && css`
    border-top: 5px solid #15803d;
  `}

  ${props => props.variant === 'purchase' && css`
    border-top: 5px solid #0f766e;
  `}

  ${props => props.variant === 'out' && css`
    border-top: 5px solid #1d4ed8;
  `}

  ${props => props.variant === 'return' && css`
    border-top: 5px solid #d97706;
  `}

  ${props => props.variant === 'interbranch' && css`
    border-top: 5px solid #4f46e5;
  `}

  ${props => props.hoverLift && css`
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
  `}
`;

export const BigActionCard3D = styled.div<{ dir: 'in' | 'out' | 'return' | 'purchase' | 'interbranch' }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 148px;
  padding: 20px 16px;
  border-radius: 16px;
  color: #ffffff;
  cursor: pointer;
  user-select: none;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-decoration: none;
  transition: all 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);

  @media (min-width: 640px) {
    min-height: 168px;
    font-size: 1.7rem;
    padding: 24px 20px;
    gap: 12px;
  }

  ${props => {
    switch (props.dir) {
      case 'in':
        return css`
          background: #15803d;
          border: 1px solid #14532d;
          box-shadow: 0 5px 0 #0f5b2b, 0 8px 16px rgba(21, 128, 61, 0.25);
          &:hover {
            background: #16a34a;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 #0f5b2b, 0 4px 8px rgba(21, 128, 61, 0.2);
          }
        `;
      case 'purchase':
        return css`
          background: #0f766e;
          border: 1px solid #115e59;
          box-shadow: 0 5px 0 #134e4a, 0 8px 16px rgba(15, 118, 110, 0.25);
          &:hover {
            background: #115e59;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 #134e4a, 0 4px 8px rgba(15, 118, 110, 0.2);
          }
        `;
      case 'out':
        return css`
          background: #1d4ed8;
          border: 1px solid #1e40af;
          box-shadow: 0 5px 0 #172554, 0 8px 16px rgba(29, 78, 216, 0.25);
          &:hover {
            background: #2563eb;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 #172554, 0 4px 8px rgba(29, 78, 216, 0.2);
          }
        `;
      case 'return':
        return css`
          background: #d97706;
          border: 1px solid #b45309;
          box-shadow: 0 5px 0 #92400e, 0 8px 16px rgba(217, 119, 6, 0.25);
          &:hover {
            background: #f59e0b;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 #92400e, 0 4px 8px rgba(217, 119, 6, 0.2);
          }
        `;
      case 'interbranch':
        return css`
          background: #4f46e5;
          border: 1px solid #4338ca;
          box-shadow: 0 5px 0 #3730a3, 0 8px 16px rgba(79, 70, 229, 0.25);
          &:hover {
            background: #6366f1;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 #3730a3, 0 4px 8px rgba(79, 70, 229, 0.2);
          }
        `;
    }
  }}

  small {
    font-size: 0.82rem;
    font-weight: 500;
    opacity: 0.95;
    letter-spacing: normal;
  }
`;

export const Button3D = styled.button<{
  variant?: 'in' | 'out' | 'sec' | 'bad' | 'brand' | 'purchase';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition: all 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);

  ${props => {
    switch (props.size) {
      case 'sm':
        return css`
          padding: 8px 14px;
          font-size: 0.875rem;
          min-height: 40px;
          box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
          @media (min-width: 640px) {
            padding: 6px 12px;
            font-size: 0.82rem;
            min-height: 34px;
          }
          &:active {
            transform: translateY(2px);
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
          }
        `;
      case 'lg':
        return css`
          padding: 14px 24px;
          font-size: 1.05rem;
          min-height: 48px;
          box-shadow: 0 5px 0 rgba(0, 0, 0, 0.2);
          @media (min-width: 640px) {
            padding: 12px 24px;
            font-size: 1rem;
            min-height: 44px;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
          }
        `;
      case 'xl':
        return css`
          width: 100%;
          padding: 16px 24px;
          font-size: 1.15rem;
          min-height: 52px;
          box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25);
          &:active {
            transform: translateY(3px);
            box-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
          }
        `;
      default:
        return css`
          padding: 11px 18px;
          font-size: 0.95rem;
          min-height: 44px;
          box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
          @media (min-width: 640px) {
            padding: 9px 18px;
            font-size: 0.88rem;
            min-height: 38px;
          }
          &:active {
            transform: translateY(3px);
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
          }
        `;
    }
  }}

  ${props => {
    switch (props.variant) {
      case 'in':
        return css`
          background-color: #15803d;
          color: #ffffff;
          border: 1px solid #14532d;
          box-shadow: 0 4px 0 #0f5b2b;
          &:hover {
            background-color: #16a34a;
          }
          &:active {
            box-shadow: 0 1px 0 #0f5b2b;
          }
        `;
      case 'purchase':
        return css`
          background-color: #0f766e;
          color: #ffffff;
          border: 1px solid #115e59;
          box-shadow: 0 4px 0 #134e4a;
          &:hover {
            background-color: #115e59;
          }
          &:active {
            box-shadow: 0 1px 0 #134e4a;
          }
        `;
      case 'out':
        return css`
          background-color: #1d4ed8;
          color: #ffffff;
          border: 1px solid #1e40af;
          box-shadow: 0 4px 0 #172554;
          &:hover {
            background-color: #2563eb;
          }
          &:active {
            box-shadow: 0 1px 0 #172554;
          }
        `;
      case 'bad':
        return css`
          background-color: #b91c1c;
          color: #ffffff;
          border: 1px solid #991b1b;
          box-shadow: 0 4px 0 #7f1d1d;
          &:hover {
            background-color: #dc2626;
          }
          &:active {
            box-shadow: 0 1px 0 #7f1d1d;
          }
        `;
      case 'brand':
        return css`
          background-color: #14532d;
          color: #ffffff;
          border: 1px solid #0f3d21;
          box-shadow: 0 4px 0 #092614;
          &:hover {
            background-color: #166534;
          }
          &:active {
            box-shadow: 0 1px 0 #092614;
          }
        `;
      default:
        return css`
          background-color: #ffffff;
          color: #1b1f24;
          border: 1px solid #dde1e6;
          box-shadow: 0 3px 0 #cbd5e1;
          &:hover {
            background-color: #f8fafc;
            color: #15803d;
          }
          &:active {
            box-shadow: 0 1px 0 #cbd5e1;
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
`;

export const StatusBadge = styled.span<{ variant: 'in' | 'out' | 'ok' | 'warn' | 'bad' | 'mut' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
  line-height: 1.4;

  ${props => {
    switch (props.variant) {
      case 'in':
        return css`
          background: #eaf6ee;
          color: #15803d;
        `;
      case 'out':
        return css`
          background: #e9effd;
          color: #1d4ed8;
        `;
      case 'ok':
        return css`
          background: #e8f6ed;
          color: #15803d;
        `;
      case 'warn':
        return css`
          background: #fdf6e3;
          color: #9a6700;
        `;
      case 'bad':
        return css`
          background: #fdecec;
          color: #b91c1c;
        `;
      default:
        return css`
          background: #eceff2;
          color: #555555;
        `;
    }
  }}
`;

export const KpiCard = styled.div<{ alert?: 'warn' | 'bad' }>`
  background: #ffffff;
  border: 1px solid #dde1e6;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  @media (min-width: 640px) {
    padding: 18px 22px;
  }

  ${props => props.alert === 'warn' && css`
    border-left: 6px solid #b45309;
    background: linear-gradient(to right, #fffbeb, #ffffff 45%);
  `}

  ${props => props.alert === 'bad' && css`
    border-left: 6px solid #b91c1c;
    background: linear-gradient(to right, #fef2f2, #ffffff 45%);
    .kpi-val {
      color: #b91c1c;
    }
  `}

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.07);
  }
`;

export const StageColumn = styled.div<{ isOver?: boolean }>`
  display: flex;
  flex-direction: column;
  background: ${props => props.isOver ? '#eaf6ee' : '#f8fafc'};
  border: 1px solid ${props => props.isOver ? '#15803d' : '#dde1e6'};
  border-radius: 10px;
  min-height: 480px;
  transition: all 0.2s ease;
`;
