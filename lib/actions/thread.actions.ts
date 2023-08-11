'use server'

import { revalidatePath } from 'next/cache'
import Thread from '../models/thread.model'
import User from '../models/user.model'
import { connectToDB } from '../mongoose'
import { skip } from 'node:test'

interface Params {
	text: string
	author: string
	communityId: string | null
	path: string
}

export async function createThread({
	text,
	author,
	communityId,
	path,
}: Params) {
	try {
		connectToDB()

		const createThread = await Thread.create({
			text,
			author,
			community: null,
		})

		// update user model
		// add thread to user's threads array
		await User.findByIdAndUpdate(author, {
			$push: { threads: createThread._id },
		})

		revalidatePath(path)
	} catch (error: any) {
		throw new Error(`Error creating thread: ${error}`)
	}
}

export async function fetchThreads(pageNumber = 1, pageSize = 20) {
	connectToDB()

	// Calculate the number of threads to skip
	const skipAmount = pageSize * (pageNumber - 1)

	// Fetch the threads that have no parents (top-level threads...)
	const threadQuery = Thread.find({ parentId: { $in: [null, undefined] } }) // get top level threads
		.sort({ createdAt: 'desc' })
		.skip(skipAmount)
		.limit(pageSize)
		.populate({ path: 'author', model: User })
		.populate({
			path: 'children',
			populate: {
				path: 'author',
				model: User,
				select: '_id name parentId image',
			},
		})

	const totalThreadCount = await Thread.countDocuments({
		parentId: { $in: [null, undefined] },
	}) // get top level threads

	const threads = await threadQuery.exec()

	const isNext = totalThreadCount > skipAmount + threads.length

	return { threads, isNext }
}
