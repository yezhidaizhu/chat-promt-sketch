export function scrollWheelHorizontally(event) {
  const element = event.currentTarget;
  if (element.scrollWidth <= element.clientWidth) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  element.scrollLeft += delta;
  event.preventDefault();
}
