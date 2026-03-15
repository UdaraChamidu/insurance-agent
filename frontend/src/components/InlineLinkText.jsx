import { Fragment } from 'react';
import { Link } from 'react-router-dom';

const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

export default function InlineLinkText({ text }) {
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'link',
      label: match[1],
      href: match[2],
    });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          if (part.href.startsWith('/')) {
              return (
                <Link
                  key={`${part.href}-${index}`}
                  className="link-accent"
                  to={part.href}
                >
                  {part.label}
              </Link>
            );
          }

          return (
            <a
              key={`${part.href}-${index}`}
              className="link-accent"
              href={part.href}
              rel="noreferrer"
              target="_blank"
            >
              {part.label}
            </a>
          );
        }

        return <Fragment key={`text-${index}`}>{part.value}</Fragment>;
      })}
    </>
  );
}
