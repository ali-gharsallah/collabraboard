#include<stdlib.h>
#include<clutter/clutter.h>

//using namespace std;

gboolean stage_is_fullscreen = false;

ClutterActor *ui_group = NULL;

static gboolean redraw_stage(ClutterStage *stage);

static gboolean on_stage_button_press(ClutterStage *stage, ClutterEvent *event, gpointer data) {
	gint x = 0;
	gint y = 0;
	clutter_event_get_coords (event, &x, &y);

	g_print("Stage clicked at (%d, %d)\n", x, y);

	if (stage_is_fullscreen == false) {
		clutter_stage_fullscreen(stage);
	} else {
		clutter_stage_unfullscreen(stage);
	}

	return TRUE; /* Stop further handling of this event */
}

static gboolean redraw_stage (ClutterStage *stage) {
	guint stage_width = NULL;
	guint stage_height = NULL;

	clutter_actor_get_size (CLUTTER_ACTOR (stage), &stage_width, &stage_height);
	g_print("%d, %d", stage_width, stage_height);

	clutter_actor_set_size (ui_group, stage_width, stage_height);

	return TRUE;
}

static gboolean on_stage_fullscreen(ClutterStage *stage, ClutterEvent *event, gpointer data) {
	stage_is_fullscreen = true;

	return TRUE;
}

static gboolean on_stage_unfullscreen(ClutterStage *stage, ClutterEvent *event, gpointer data) {
	stage_is_fullscreen = false;

	return TRUE;
}

int main(int argc, char *argv[]) {
	clutter_init(&argc, &argv);

	ClutterColor stage_color = { 0xff, 0xff, 0xff, 0x00 }; /* Black */
	ClutterColor actor_color = { 0xff, 0xff, 0xff, 0x99 }; /* Gray */

	ClutterActor *stage = clutter_stage_get_default ();
	clutter_actor_set_size (stage, 800, 800);
	clutter_stage_set_color (CLUTTER_STAGE (stage), &stage_color);
	clutter_stage_set_user_resizable (CLUTTER_STAGE (stage), true);

	guint stage_width = NULL;
	guint stage_height = NULL;

	ClutterActor *ui_group = clutter_group_new ();
	clutter_actor_set_size (ui_group, stage_width, stage_height);
	clutter_actor_set_position (ui_group, 0, 0);
	clutter_container_add_actor (CLUTTER_CONTAINER (stage), ui_group);
	clutter_actor_show (ui_group);

	//ClutterActor *group = clutter_group_new ();
	//clutter_actor_set_position (group, 40, 40);
	//clutter_container_add_actor (CLUTTER_CONTAINER (stage), group);
	//clutter_actor_show (group);

	/* Experiment with adding a texture */
	GError *error = NULL;
	gchar *filename = NULL;
	filename = (char *) g_malloc (40);
	filename = "texture.png";

	/*
	ClutterActor *texture = clutter_texture_new_from_file (filename, &error);

	if (texture == NULL) {
		g_print ("Error! Error! \n");
	}
	clutter_actor_set_size(texture, 300, 300);
	clutter_actor_set_position(texture, 200, 200);
	clutter_actor_show(texture);
	clutter_container_add_actor (CLUTTER_CONTAINER (stage), texture);
	clutter_actor_set_rotation (texture, CLUTTER_X_AXIS, 100, 0, 0, 0);
	*/

	/* Add a button */
	GError *error_2 = NULL;
	gchar *filename_savefile = NULL;
	filename_savefile = (char *) g_malloc (40);
	filename_savefile = "savefile.png";

	ClutterActor *save_file = clutter_texture_new_from_file (filename_savefile, &error_2);

	if (save_file == NULL) {
		g_print ("Error! Error! \n");
	}
	//clutter_actor_set_size(save_file, 300, 300);
	clutter_actor_set_position(save_file, 0, 200);
	clutter_actor_show(save_file);
	clutter_container_add_actor (CLUTTER_CONTAINER (ui_group), save_file);

	/* Add a rectangle to the stage */
	//ClutterActor *rect = clutter_rectangle_new_with_color (&actor_color);
	//clutter_actor_set_size (rect, 100, 100);
	//clutter_actor_set_position (rect, 20, 20);
	//clutter_container_add_actor (CLUTTER_CONTAINER (group), rect);
	//clutter_actor_show (rect);

	/* Add a label to the stage */
	//ClutterActor *label = clutter_label_new_full ("Sans 12", "Test Text", &actor_color);
	//clutter_actor_set_size (label, 500, 500);
	//clutter_actor_set_position (label, 20, 150);
	//clutter_container_add_actor (CLUTTER_CONTAINER (group), label);
	//clutter_actor_show (label);

	/* Rotate -20 degrees about X axis (about its top edge) */
	//clutter_actor_set_rotation (group, CLUTTER_Z_AXIS, 10, 0, 0, 0);

	/* Scale 300% along the x-axis */
	//clutter_actor_set_scale (group, 3.00, 1.0);

	/* Show the stage */
	clutter_actor_show (stage);

	/* Connect a signal handler to handle mouse clicks and key presses on the stage: */
	g_signal_connect (stage, "button-press-event", G_CALLBACK (on_stage_button_press), NULL);
	g_signal_connect (stage, "fullscreen", G_CALLBACK (on_stage_fullscreen), NULL);
	g_signal_connect (stage, "unfullscreen", G_CALLBACK (on_stage_unfullscreen), NULL);

	/* Start the main loop, so we can respond to events: */
	clutter_main ();

	return EXIT_SUCCESS;
}
