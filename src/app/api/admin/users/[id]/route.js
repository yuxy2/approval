import { NextResponse } from 'next/server';
import { verifySession } from '@/utils/session';
import { updatePmUser, deletePmUser } from '@/db';
import bcrypt from 'bcryptjs';

// PUT: Update a user's details (Requires superadmin)
export async function PUT(request, { params }) {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin authorization required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, role, active, password } = body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (role) updateData.role = role;
    if (active !== undefined) updateData.active = Boolean(active);

    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await updatePmUser(id, updateData);
    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found or update failed' },
        { status: 404 }
      );
    }

    // Exclude password from response
    const { password: _, ...safeUser } = updatedUser;

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error(`API admin/users/[id] PUT error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a user (Requires superadmin)
export async function DELETE(request, { params }) {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Superadmin authorization required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent a superadmin from deleting their own account
    if (session.userId === id.toString()) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own active superadmin account' },
        { status: 400 }
      );
    }

    const deletedUser = await deletePmUser(id);
    if (!deletedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found or delete failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error(`API admin/users/[id] DELETE error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
