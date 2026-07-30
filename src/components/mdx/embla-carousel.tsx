"use client";

import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

interface CarouselImage {
  src: string;
  alt?: string;
  caption?: string;
  sharedCaption?: string;
}

export default function EmblaCarousel({
  images = [],
  options = {},
}: {
  images?: CarouselImage[];
  options?: Record<string, unknown>;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, ...options });
  const [prevDisabled, setPrevDisabled] = useState(true);
  const [nextDisabled, setNextDisabled] = useState(true);

  const scrollPrev = useCallback(
    () => emblaApi && emblaApi.scrollPrev(),
    [emblaApi],
  );
  const scrollNext = useCallback(
    () => emblaApi && emblaApi.scrollNext(),
    [emblaApi],
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevDisabled(!emblaApi.canScrollPrev());
    setNextDisabled(!emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const sharedCaption = images[0]?.sharedCaption;

  return (
    <section>
      <style>{`
        .embla__outer {
          padding: 0.5rem;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          max-width: 440px;
          margin: 0 auto;
        }
        .embla__viewport {
          overflow: hidden;
          border-radius: 0.375rem;
          width: 100%;
        }
        .embla__container {
          display: flex;
          height: 280px;
        }
        .embla__slide {
          flex: 0 0 100%;
          min-width: 0;
          position: relative;
          display: flex;
          justify-content: center;
          overflow: hidden;
        }
        .embla__slide__img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .embla__caption {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          font-size: 0.75rem;
          line-height: 1rem;
          padding: 4px 8px;
          text-align: center;
        }
        .embla__shared-caption {
          text-align: center;
          font-size: 0.75rem;
          font-style: italic;
          color: #6b7280;
          margin: 0.5rem auto 0;
          max-width: 440px;
        }
        .dark .embla__shared-caption {
          color: #9ca3af;
        }
        .embla__controls {
          display: flex;
          justify-content: center;
          margin-top: 0.5rem;
        }
        .embla__buttons {
          display: flex;
          gap: 0.5rem;
        }
        .embla__button {
          appearance: none;
          background: transparent;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 9999px;
          width: 2.2rem;
          height: 2.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: currentColor;
          transition: background 0.2s;
          padding: 0.4rem;
        }
        .embla__button:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.05);
        }
        .embla__button:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .dark .embla__button {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .dark .embla__button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
        }
        .embla__button__svg {
          width: 100%;
          height: 100%;
        }
      `}</style>

      <div className="embla__outer">
        <div className="embla__viewport" ref={emblaRef}>
          <div className="embla__container">
            {images.map((image, index) => (
              <div className="embla__slide" key={index}>
                <img
                  src={image.src}
                  alt={image.alt || ""}
                  className="embla__slide__img"
                  loading="lazy"
                  decoding="async"
                />
                {image.caption && (
                  <figcaption className="embla__caption">
                    {image.caption}
                  </figcaption>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sharedCaption && (
        <p className="embla__shared-caption">{sharedCaption}</p>
      )}

      <div className="embla__controls">
        <div className="embla__buttons">
          <button
            className="embla__button embla__button--prev"
            type="button"
            onClick={scrollPrev}
            disabled={prevDisabled}
            aria-label="Previous"
          >
            <svg className="embla__button__svg" viewBox="0 0 532 532">
              <path
                fill="currentColor"
                d="M355.66 11.354c13.793-13.805 36.208-13.805 50.001 0 13.785 13.804 13.785 36.238 0 50.034L201.22 266l204.442 204.61c13.785 13.805 13.785 36.239 0 50.044-13.793 13.796-36.208 13.796-50.002 0a5994246.277 5994246.277 0 0 0-229.332-229.454 35.065 35.065 0 0 1-10.326-25.126c0-9.2 3.393-18.26 10.326-25.2C172.192 194.973 332.731 34.31 355.66 11.354Z"
              />
            </svg>
          </button>
          <button
            className="embla__button embla__button--next"
            type="button"
            onClick={scrollNext}
            disabled={nextDisabled}
            aria-label="Next"
          >
            <svg className="embla__button__svg" viewBox="0 0 532 532">
              <path
                fill="currentColor"
                d="M176.34 520.646c-13.793 13.805-36.208 13.805-50.001 0-13.785-13.804-13.785-36.238 0-50.034L330.78 266 126.34 61.391c-13.785-13.805-13.785-36.239 0-50.044 13.793-13.796 36.208-13.796 50.002 0 22.928 22.947 206.395 206.507 229.332 229.454a35.065 35.065 0 0 1 10.326 25.126c0 9.2-3.393 18.26-10.326 25.2-45.865 45.901-206.404 206.564-229.332 229.52Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
