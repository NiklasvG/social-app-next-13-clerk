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

export async function fetchThreadById(id: string) {
	connectToDB()

	try {
		const thread = await Thread.findById(id)
			// TODO: Populate community
			.populate({ path: 'author', model: User, select: '_id id name image' })
			.populate({
				path: 'children',
				populate: [
					{
						path: 'author',
						model: User,
						select: '_id id parentId name image',
					},
					{
						path: 'children',
						model: Thread,
						populate: {
							path: 'author',
							model: User,
							select: '_id id parentId name image',
						},
					},
				],
			})
			.exec()

		return thread
	} catch (error: any) {
		throw new Error(`Error fetching thread: ${error}`)
	}
}

export async function addCommentToThread(
	threadId: string,
	commentText: string,
	userId: string,
	path: string
) {
	connectToDB()

	try {
		//* adding a comment to a thread

		// find original thread
		const originalThread = await Thread.findById(threadId)

		if (!originalThread) {
			throw new Error('Thread not found')
		}

		// create new thread with the comment text

		const commentThread = new Thread({
			text: commentText,
			author: userId,
			parentId: threadId,
		})

		// save new thread
		const savedCommentThread = await commentThread.save()

		// update original thread
		originalThread.children.push(savedCommentThread._id)

		// save original thread
		await originalThread.save()

		revalidatePath(path)
	} catch (error: any) {
		throw new Error(`Error adding comment to thread: ${error}`)
	}
}
