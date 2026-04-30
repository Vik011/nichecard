import { render, screen } from '@testing-library/react'
import { TestimonialsSection } from './TestimonialsSection'
import { COPY } from './copy'

const copy = COPY.en

describe('TestimonialsSection', () => {
  it('renders testimonialsTitle', () => {
    render(<TestimonialsSection copy={copy} />)
    expect(screen.getByText(copy.testimonialsTitle)).toBeInTheDocument()
  })

  it('renders all testimonial names', () => {
    render(<TestimonialsSection copy={copy} />)
    copy.testimonials.forEach(t => {
      expect(screen.getByText(t.name)).toBeInTheDocument()
    })
  })

  it('renders all testimonial handles', () => {
    render(<TestimonialsSection copy={copy} />)
    copy.testimonials.forEach(t => {
      expect(screen.getByText(t.handle)).toBeInTheDocument()
    })
  })

  it('renders all testimonial quotes', () => {
    render(<TestimonialsSection copy={copy} />)
    copy.testimonials.forEach(t => {
      expect(screen.getByText(`"${t.quote}"`)).toBeInTheDocument()
    })
  })
})
