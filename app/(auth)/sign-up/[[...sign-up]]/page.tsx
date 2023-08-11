import { SignUp } from '@clerk/nextjs'

export default function Page() {
	return (
		<section className="min-h-screen grid place-items-center">
			<SignUp />
		</section>
	)
}
